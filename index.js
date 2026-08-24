const { TikTokLiveConnection, WebcastEvent } = require('tiktok-live-connector');


const express = require('express');
const app = express();
const port = 3000;

const http = require('http');
const { Server } = require('socket.io');
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
  }
});

const PLAYERS = 500;
const PLAYER_SIZE = 50;

const MAX_ATTEMPTS = 3; // Maximum attempts to place a player without overlap

const COLORS = ['#ff0000', '#00ff00', '#0000ff', '#ffff00', '#ff00ff', '#ffaa00', '#00ffff', '#ff00aa'];
const NAMES = ['Alice', 'Bob', 'Charlie', 'Diana', 'Eve', 'Frank', 'Grace', 'Heidi', 'Ivan', 'Julia', 'Kevin', 'Linda', 'Mike', 'Nina', 'Oscar', 'Paula', 'Quinn', 'Rachel', 'Steve', 'Tina'];
const SUFFIXES = ['Jr.', 'Sr.', 'III', 'IV', 'V'];

const WORLD_WIDTH = 1800; // Width of the world
const WORLD_HEIGHT = 1000; // Height of the world


const PADDING = 10; // Padding between players to prevent overlap
const BORDER_WIDTH = 10;


let players = [];

function startTikTokConnection(username, socket) {
    players = []; // Reset players array when a new username is provided
    const connection = new TikTokLiveConnection(username, {});

    connection.connect().then(state => {
        console.log(`Connected to roomId ${state.roomId}`);
    }).catch(err => {
        socket.emit('tiktokError', 'Failed to connect to TikTok live stream. Please check the username and try again.');
        console.error('Failed to connect to TikTok live stream:', err);
    });

    connection.on(WebcastEvent.MEMBER, (data) => {
        const nickname = data.user?.nickname;
        const uid = data.user?.id?.toString();
        const url = data.user?.avatarThumb?.urlList?.[0];
        // console.log(data.user);
        if (nickname) {
            console.log(`New member: ${nickname}`);
            if(!players.some(player => player.id === uid)) {
                createPlayer(uid, nickname, url);
            }
        }
    });

    connection.on(WebcastEvent.CHAT, (data) => {
        const uid = data.user?.id?.toString();
        console.log(`Chat message from user ${uid}: ${data.user}`);
        if (uid) {
            clearInactiveTimer(uid);
            scalePlayer(uid, 10); // Increase size by 10 units
        }
    });
    connection.on(WebcastEvent.GIFT, (data) => {
        const uid = data.user?.id?.toString();
        if (uid) {
            clearInactiveTimer(uid);
            scalePlayer(uid, 20); // Increase size by 20 units
        }
    });
    connection.on(WebcastEvent.LIKE, (data) => {
        const uid = data.user?.id?.toString();
        if (uid) {
            clearInactiveTimer(uid);
            scalePlayer(uid, 5); // Increase size by 5 units
        }
    });
    connection.on(WebcastEvent.SOCIAL, (data) => {
        const uid = data.user?.id?.toString();
        if (uid) {
            clearInactiveTimer(uid);
            scalePlayer(uid, 15); // Increase size by 15 units
        }
    });
    connection.on(WebcastEvent.ENVELOPE, (data) => {
        const uid = data.user?.id?.toString();
        if (uid) {
            clearInactiveTimer(uid);
            scalePlayer(uid, 25); // Increase size by 25 units
        }
    });
    connection.on(WebcastEvent.FOLLOW, (data) => {
        const uid = data.user?.id?.toString();
        if (uid) {
            clearInactiveTimer(uid);
            scalePlayer(uid, 30); // Increase size by 30 units
        }
    });
    connection.on(WebcastEvent.SHARE, (data) => {
        const uid = data.user?.id?.toString();
        if (uid) {
            clearInactiveTimer(uid);
            scalePlayer(uid, 35); // Increase size by 35 units
        }
    });
    return connection;
}

function updatePlayerPosition(player) {
    if (player.asleepTimer !== undefined) {
        return; // Do not update position if the player is asleep
    }

    const speed = 2; // Adjust the speed as needed

    // Randomly change direction
    if (Math.random() < 0.02) {
        player.x += (Math.random() - 0.5) * speed * 10;
        player.y += (Math.random() - 0.5) * speed * 10;
    }

    // Keep the player within the canvas bounds
    player.x = Math.max(0+BORDER_WIDTH, Math.min(player.x, WORLD_WIDTH - PLAYER_SIZE -BORDER_WIDTH));
    player.y = Math.max(0+BORDER_WIDTH, Math.min(player.y, WORLD_HEIGHT - PLAYER_SIZE -BORDER_WIDTH));
}

function updatePlayerState(player) {
    player.inactiveTimer++;

    if(player.showNameTimer !== undefined) {
        player.showNameTimer--;
        if(player.showNameTimer <= 0) {
            delete player.showNameTimer;
        }
    }
    if(player.asleepTimer !== undefined) {
        player.asleepTimer--;
        if(player.asleepTimer <= 0) {
            delete player.asleepTimer;
        }
    }
}


function doPlayersOverlap(player1, player2) {
    return !(
        player1.x + PLAYER_SIZE + PADDING < player2.x ||
        player1.x > player2.x + PLAYER_SIZE + PADDING ||
        player1.y + PLAYER_SIZE + PADDING < player2.y ||
        player1.y > player2.y + PLAYER_SIZE + PADDING
    );
}

// function spawnPlayers() {
//     const players = [];
//     let attemptCount = 0;
//     let uid = 0;
//     for (let i = 0; i < PLAYERS; i++) {
//         if (attemptCount > 100) {
//             console.error('Could not place all players without overlap after 100 attempts.');
//             break;
//         }
//         let newPlayer = {
//             id: uid++,
//             x: Math.random() * (WORLD_WIDTH - PLAYER_SIZE),
//             y: Math.random() * (WORLD_HEIGHT - PLAYER_SIZE),
//             color: COLORS[Math.floor(Math.random() * COLORS.length)],
//             name: NAMES[Math.floor(Math.random() * NAMES.length)],
//             inactiveTimer: 0,
//         };
//         if (Math.random() < 0.5) { // 50% chance to have a suffix
//             newPlayer.suffix = SUFFIXES[Math.floor(Math.random() * SUFFIXES.length)];
//         }
//         let overlapFound = false;
//         for (const player of players) {
//             if (doPlayersOverlap(newPlayer, player)) {
//                 i--;
//                 attemptCount++;
//                 overlapFound = true;
//                 break;
//             }
//         } 
//         if (!overlapFound) {
//             players.push(newPlayer);
//         }
//     }
//     return players;
// }

function clearInactiveTimer(playerId) {
    const player = players.find(p => p.id === playerId);
    if (player) {
        console.log(`Resetting inactive timer for player ${playerId} (${player.name})`);
        player.inactiveTimer = 0;
    }
}
function scalePlayer(uid, scaleFactor) {
    const player = players.find(p => p.id === uid);
    if (player) {
        player.scale += scaleFactor;
    }
}

function createPlayer(uid, nickname, avatarUrl) {
    for (let i = 0; i < MAX_ATTEMPTS; i++) {
        let newPlayer = {
            id: uid,
            x: Math.random() * (WORLD_WIDTH - PLAYER_SIZE),
            y: Math.random() * (WORLD_HEIGHT - PLAYER_SIZE),
            scale: PLAYER_SIZE,
            color: COLORS[Math.floor(Math.random() * COLORS.length)],
            name: nickname || NAMES[Math.floor(Math.random() * NAMES.length)],
            url: avatarUrl,
            inactiveTimer: 0,
        };
        let overlapFound = false;
        for (const player of players) {
            if (doPlayersOverlap(newPlayer, player)) {
                overlapFound = true;
                break;
            }
        } 
        if (!overlapFound) {
            players.push(newPlayer);
            return;
        }
    }
    console.error('Could not place player without overlap after 100 attempts.');
}


// const players = spawnPlayers();

app.get('/players', (req, res) => {
    console.log('Sending players data:', players);
  res.json(players);
});

app.get('/', (req, res) => {
  res.send('Hello World!');
});

server.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});

let tiktokConnection = null;

io.on('connection', (socket) => {
    console.log(`A user connected: ${socket.id}`);
    socket.emit('players', players);
    socket.emit('worldDimensions', { width: WORLD_WIDTH, height: WORLD_HEIGHT });
    socket.on('disconnect', () => {
        console.log(`User disconnected: ${socket.id}`);
        tiktokConnection?.disconnect();
        tiktokConnection = null;
    });
    socket.on('tiktokUsername', (username) => {
        console.log(`Received TikTok username: ${username}`);
        tiktokConnection = startTikTokConnection(username, socket);
    });
    socket.on('showName', (playerId) => {
        const player = players.find(p => p.id === playerId);
        if (player) {
            player.showNameTimer = 60; // Show name for 60 frames (~1 second at 60fps)
        }
    });
});



setInterval(() => {
    players.forEach(player => {
        updatePlayerPosition(player);
        updatePlayerState(player);
    });
    players = players.filter(player => player.inactiveTimer <= 2000); // Remove players inactive for more than 10 seconds
    io.emit('players', players);
}, 1000 / 30); // 30 times per second