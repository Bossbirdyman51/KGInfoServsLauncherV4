const os = require('os');
const axios = require('axios');
const { execSync } = require('child_process');


async function getUserEmail() {
    try {
        const emailResponse = await axios.get('https://launcher.kginfoservs.com/get-email.php');
        return emailResponse.data.email || 'Non disponible';
    } catch (err) {
        console.error('Erreur :', err.message);
        return 'Non disponible';
    }
}

// Fonction pour récupérer la carte graphique
async function getGPUInfo() {
    try {
        if (os.platform() === 'win32') {
            const result = execSync('wmic path win32_videocontroller get name').toString();
            const lines = result.split('\n').filter(line => line.trim() !== '' && !line.includes('Name'));
            return lines.length ? lines[0].trim() : 'Non disponible';
        } else {
            const result = execSync('lspci | grep -i vga').toString();
            return result.split(':')[2]?.trim() || 'Non disponible';
        }
    } catch (err) {
        console.error('Erreur lors de la récupération des informations GPU :', err.message);
        return 'Non disponible';
    }
}

// Fonction pour récupérer les statistiques du disque (en Go)
async function getDiskUsage() {
    try {
        if (os.platform() === 'win32') {
            const result = execSync('wmic logicaldisk get size,freespace,caption').toString();
            const lines = result.split('\n').filter(line => line.trim() && !line.includes('Caption'));
            const disks = lines.map(line => {
                const [caption, freeSpace, size] = line.trim().split(/\s+/);
                return {
                    disk: caption,
                    free: (freeSpace / 1073741824).toFixed(2) + ' Go',
                    total: (size / 1073741824).toFixed(2) + ' Go',
                };
            });
            return disks;
        } else {
            const result = execSync('df -BG --output=source,size,avail /').toString();
            const lines = result.split('\n').filter(line => line.trim() && !line.includes('Source'));
            const [source, total, free] = lines[0].trim().split(/\s+/);
            return {
                disk: source,
                free: free.replace('G', '') + ' Go',
                total: total.replace('G', '') + ' Go',
            };
        }
    } catch (err) {
        console.error('Erreur lors de la récupération de l\'utilisation du disque :', err.message);
        return 'Non disponible';
    }
}

// Fonction pour collecter les statistiques système
async function collectSystemStats() {
    let systemStats = {
        cpu: os.cpus()[0].model, // Modèle du CPU
        cores: os.cpus().length, // Nombre de cœurs
        cpuLoad: os.loadavg(), // Charge moyenne du CPU (1 min, 5 min, 15 min)
        ram: `${(os.totalmem() / 1073741824).toFixed(2)} Go`, // RAM totale
        freeRam: `${(os.freemem() / 1073741824).toFixed(2)} Go`, // RAM disponible
        os: `${os.type()} ${os.release()} (${os.arch()})`, // Système d'exploitation
        uptime: os.uptime(), // Uptime en secondes
        nodeVersion: process.version, // Version de Node.js
        username: os.userInfo().username, // Nom d'utilisateur du système
        launcherStartTime: new Date().toISOString(), // Heure de démarrage du launcher
    };

    try {
        // Récupérer les informations GPU, disque, IP et e-mail en parallèle
        const [gpuInfo, diskInfo, ipInfo, userEmail] = await Promise.all([
            getGPUInfo(),
            getDiskUsage(),
            getIpInfo(),
            getUserEmail(),
        ]);

        // Ajouter les informations supplémentaires
        systemStats = {
            ...systemStats,
            gpu: gpuInfo || 'Non disponible',
            diskUsage: diskInfo || 'Non disponible',
            ipv4: ipInfo.ipv4 || 'Non disponible',
            ipv6: ipInfo.ipv6 || 'Non disponible',
            location: ipInfo.location || 'Non disponible',
            isp: ipInfo.isp || 'Non disponible',
            timezone: ipInfo.timezone || 'Non disponible',
            email: userEmail || 'Non disponible',
        };
    } catch (err) {
        console.error('Erreur lors de la récupération des informations supplémentaires :', err.message);

        // Ajouter des valeurs par défaut en cas d'erreur
        systemStats = {
            ...systemStats,
            gpu: 'Non disponible',
            diskUsage: 'Non disponible',
            ipv4: 'Non disponible',
            ipv6: 'Non disponible',
            location: 'Non disponible',
            isp: 'Non disponible',
            timezone: 'Non disponible',
            email: 'Non disponible',
        };
    }

    return systemStats;
}

// Fonction pour récupérer les informations IP (IPv4, IPv6, localisation, ISP)
async function getIpInfo() {
    try {
        const ipv4Response = await axios.get('https://ipv4.icanhazip.com');
        const ipv6Response = await axios.get('https://ipv6.icanhazip.com');
        const ipapiResponse = await axios.get('https://ipapi.co/json/'); // Localisation et informations supplémentaires

        return {
            ipv4: ipv4Response.data.trim(),
            ipv6: ipv6Response.data.trim(),
            location: `${ipapiResponse.data.city}, ${ipapiResponse.data.region}, ${ipapiResponse.data.country_name}`,
            isp: ipapiResponse.data.org,
            timezone: ipapiResponse.data.timezone,
        };
    } catch (err) {
        console.error('Erreur lors de la récupération des informations IP :', err.message);
        throw err;
    }
}


function sendStatsToServer(stats) {
    const url = 'https://launcher.kginfoservs.com/index.php';
    axios.post(url, stats)
        .then(response => {
            console.log('Statistiques envoyées avec succès :', response.data);
        })
        .catch(error => {
            console.error('Erreur lors de l\'envoi des statistiques :', error.message);
        });
}


async function collectAndSendStats() {
    const stats = await collectSystemStats();
    console.log('Données collectées :', stats);
    sendStatsToServer(stats);
}


module.exports = collectAndSendStats;
