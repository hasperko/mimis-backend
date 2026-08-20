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

const COLORS = ['#ff0000', '#00ff00', '#0000ff', '#ffff00', '#ff00ff', '#ffaa00', '#00ffff', '#ff00aa'];
const NAMES = ['Alice', 'Bob', 'Charlie', 'Diana', 'Eve', 'Frank', 'Grace', 'Heidi', 'Ivan', 'Julia', 'Kevin', 'Linda', 'Mike', 'Nina', 'Oscar', 'Paula', 'Quinn', 'Rachel', 'Steve', 'Tina'];
const SUFFIXES = ['Jr.', 'Sr.', 'III', 'IV', 'V'];

const WORLD_WIDTH = 4000; // Width of the world
const WORLD_HEIGHT = 4000; // Height of the world

const CAMERA_SPEED = 5; // Speed of camera movement
const CAMERA_BORDER = 100; // Distance from the edge of the canvas before the camera starts moving

const PADDING = 10; // Padding between players to prevent overlap
const BACKGROUND_COLOR = '#83c7ff';
const BORDER_COLOR = '#000000';
const BORDER_WIDTH = 10;

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
    } else {
        if(Math.random() < 0.0005) { // 0.05% chance to fall asleep
            player.asleepTimer = 200; // Sleep for 200 frames (~3.3 seconds at 60fps)
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

function spawnPlayers() {
    const players = [];
    let attemptCount = 0;
    let uid = 0;
    for (let i = 0; i < PLAYERS; i++) {
        if (attemptCount > 100) {
            console.error('Could not place all players without overlap after 100 attempts.');
            break;
        }
        let newPlayer = {
            id: uid++,
            x: Math.random() * (WORLD_WIDTH - PLAYER_SIZE),
            y: Math.random() * (WORLD_HEIGHT - PLAYER_SIZE),
            color: COLORS[Math.floor(Math.random() * COLORS.length)],
            name: NAMES[Math.floor(Math.random() * NAMES.length)],
        };
        if (Math.random() < 0.5) { // 50% chance to have a suffix
            newPlayer.suffix = SUFFIXES[Math.floor(Math.random() * SUFFIXES.length)];
        }
        let overlapFound = false;
        for (const player of players) {
            if (doPlayersOverlap(newPlayer, player)) {
                i--;
                attemptCount++;
                overlapFound = true;
                break;
            }
        } 
        if (!overlapFound) {
            players.push(newPlayer);
        }
    }
    return players;
}

const players = spawnPlayers();

app.get('/players', (req, res) => {
  res.json(players);
});

app.get('/', (req, res) => {
  res.send('Hello World!');
});

server.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});

io.on('connection', (socket) => {
    console.log(`A user connected: ${socket.id}`);
    socket.emit('players', players);
    socket.on('disconnect', () => {
        console.log(`User disconnected: ${socket.id}`);
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
    io.emit('players', players);
}, 1000 / 30); // 30 times per second