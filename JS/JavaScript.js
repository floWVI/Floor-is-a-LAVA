const sounds = {
    coin: new Audio('Assets/coin.mp3'),
    lava: new Audio('Assets/Lava.mp3'),
    jump: new Audio('Assets/jump.mp3'),
    button: new Audio('Assets/button.mp3')
};

sounds.lava.loop = true;
sounds.lava.volume = 0.4;
sounds.coin.volume = 0.6;
sounds.jump.volume = 0.5;
sounds.button.volume = 0.3;

(function() {
    const canvas = document.getElementById('gameCanvas');
    const ctx = canvas.getContext('2d');
    
    const GAME_W = 1024, GAME_H = 640;
    const LAVA_LEVEL = 540;
    let cameraX = 0;
    
    let player = {
        x: 200, y: 0,
        vx: 0, vy: 0,
        width: 28, height: 28,
        grounded: false,
        facingRight: true,
        justJumped: false,
        invincibleTimer: 0
    };
    
    let platforms = [];
    let coinsCollected = 0;
    let distanceMeters = 0;
    let gameActive = false;
    let currentPlayerName = "anon";
    
    const MIN_GAP = 90;
    const MAX_GAP = 280;
    const MIN_WIDTH = 70;
    const MAX_WIDTH = 150;
    const PLATFORM_HEIGHT = 10;
    const COIN_SIZE = 14;
    
    const GRAVITY = 0.68;
    const JUMP_POWER = -14.2;
    const MOVE_ACC = 0.8;
    const GROUND_FRICTION = 0.96;
    const AIR_CONTROL = 0.99;
    const MAX_SPEED = 6.8;
    
    let leaderboard = [];
    
    function loadLeaderboard() {
        const stored = localStorage.getItem("minimalLavaRun");
        if(stored) {
            try { leaderboard = JSON.parse(stored); } catch(e){ leaderboard = []; }
        }
        if(!leaderboard || leaderboard.length === 0) {
            leaderboard = [
                {name:"user", distance:120, coins:5},
                {name:"guest", distance:85, coins:3}
            ];
            saveLeaderboard();
        }
        leaderboard.sort((a,b)=>b.distance - a.distance || b.coins - a.coins);
        if(leaderboard.length > 8) leaderboard = leaderboard.slice(0,8);
        updateLeaderboardUI();
    }
    
    function saveLeaderboard() {
        localStorage.setItem("minimalLavaRun", JSON.stringify(leaderboard.slice(0,8)));
    }
    
    function addScoreEntry(name, distance, coins) {
        if(!name || name.trim() === "") name = "anon";
        leaderboard.push({name: name.trim(), distance: Math.floor(distance), coins: coins});
        leaderboard.sort((a,b)=>b.distance - a.distance || b.coins - a.coins);
        if(leaderboard.length > 8) leaderboard = leaderboard.slice(0,8);
        saveLeaderboard();
        updateLeaderboardUI();
    }
    
    function updateLeaderboardUI() {
        const listEl = document.getElementById("leaderboardList");
        if(listEl) {
            if(leaderboard.length === 0) {
                listEl.innerHTML = "<li><span>—</span><span>0</span></li>";
                return;
            }
            let html = "";
            for(let i=0; i<leaderboard.length; i++) {
                const entry = leaderboard[i];
                html += `<li><span>${entry.name}</span><span>${entry.distance}</span></li>`;
            }
            listEl.innerHTML = html;
        }
    }
    
    let worldRightmost = 500;
    
    function generatePlatformsUpTo(limitX) {
        if(platforms.length === 0) {
            platforms.push({ x: 180, y: LAVA_LEVEL - 26, width: 100, height: PLATFORM_HEIGHT, hasCoin: false, coinCollected: false });
            worldRightmost = 180 + 100;
        }
        
        while(worldRightmost < limitX + 700) {
            let lastPlat = platforms[platforms.length-1];
            let gap = MIN_GAP + Math.random() * (MAX_GAP - MIN_GAP);
            let newX = lastPlat.x + lastPlat.width + gap;
            let yOffset = Math.random() * 50 - 24;
            let newY = LAVA_LEVEL - 30 + yOffset;
            newY = Math.min(LAVA_LEVEL - 12, Math.max(LAVA_LEVEL - 80, newY));
            let newWidth = MIN_WIDTH + Math.random() * (MAX_WIDTH - MIN_WIDTH);
            let hasCoin = (platforms.length % 6 === 3) && !(platforms.length % 12 === 0);
            
            platforms.push({
                x: newX, y: newY, width: newWidth, height: PLATFORM_HEIGHT,
                hasCoin: hasCoin, coinCollected: false
            });
            worldRightmost = newX + newWidth;
        }
    }
    
    function handleCollisions() {
        player.grounded = false;
        for(let plat of platforms) {
            if(player.vy >= 0) {
                if(player.x + player.width > plat.x && player.x < plat.x + plat.width &&
                    player.y + player.height <= plat.y + 6 && player.y + player.height + player.vy >= plat.y) {
                    player.y = plat.y - player.height;
                    player.vy = 0;
                    player.grounded = true;
                    player.justJumped = false;
                }
            }
            if(player.y + player.height > plat.y && player.y < plat.y + plat.height) {
                if(player.x + player.width > plat.x && player.x < plat.x + plat.width && player.vy > 0) {
                    if(player.y + player.height - player.vy <= plat.y + 6) {
                        player.y = plat.y - player.height;
                        player.vy = 0;
                        player.grounded = true;
                        player.justJumped = false;
                    }
                }
            }
        }
    }
    
    function collectCoins() {
        for(let plat of platforms) {
            if(plat.hasCoin && !plat.coinCollected) {
                let coinX = plat.x + plat.width/2 - COIN_SIZE/2;
                let coinY = plat.y - COIN_SIZE + 4;
                if(player.x < coinX + COIN_SIZE && player.x + player.width > coinX &&
                    player.y < coinY + COIN_SIZE && player.y + player.height > coinY) {
                    plat.coinCollected = true;
                    coinsCollected++;
                    updateUI();
                    if(sounds.coin) {
                        sounds.coin.currentTime = 0;
                        sounds.coin.play().catch(e=>{});
                    }
                }
            }
        }
    }
    
    function resetGame() {
        if(sounds.lava) { sounds.lava.pause(); sounds.lava.currentTime = 0; }
        platforms = [];
        coinsCollected = 0;
        distanceMeters = 0;
        cameraX = 0;
        player = {
            x: 200, y: 0, vx: 0, vy: 0, width: 28, height: 28,
            grounded: false, facingRight: true, justJumped: false, invincibleTimer: 0
        };
        gameActive = true;
        worldRightmost = 500;
        generatePlatformsUpTo(1300);
        if(platforms.length) {
            let startPlat = platforms[0];
            player.x = startPlat.x + 12;
            player.y = startPlat.y - player.height;
            player.vy = 0;
            player.vx = 0;
        }
        updateUI();
        document.getElementById("gameOverlay").classList.add("hidden");
        document.getElementById("mainMenu").classList.add("hidden");
        if(sounds.lava) sounds.lava.play().catch(e=>{});
    }
    
    function updateUI() {
        document.getElementById("coinCounter").innerText = coinsCollected;
        document.getElementById("distanceCounter").innerText = Math.floor(distanceMeters / 9);
    }
    
    let keys = {
        ArrowRight: false, ArrowLeft: false, Space: false, KeyW: false, KeyA: false, KeyD: false, ArrowUp: false
    };
    let prevJumpPressed = false;
    
    function handleInput() {
        if(!gameActive) return;
        let move = 0;
        if(keys.ArrowRight || keys.KeyD) move = 1;
        if(keys.ArrowLeft || keys.KeyA) move = -1;
        
        if(move !== 0) {
            player.vx += move * MOVE_ACC;
            if(player.vx > MAX_SPEED) player.vx = MAX_SPEED;
            if(player.vx < -MAX_SPEED) player.vx = -MAX_SPEED;
            if(player.vx !== 0) player.facingRight = player.vx > 0;
        } else {
            if(player.grounded) player.vx *= GROUND_FRICTION;
            else player.vx *= AIR_CONTROL;
        }
        
        let jump = (keys.Space || keys.KeyW || keys.ArrowUp) && !prevJumpPressed;
        prevJumpPressed = (keys.Space || keys.KeyW || keys.ArrowUp);
        if(jump && player.grounded) {
            player.vy = JUMP_POWER;
            player.grounded = false;
            player.justJumped = true;
            if(sounds.jump) {
                sounds.jump.currentTime = 0;
                sounds.jump.play().catch(e=>{});
            }
            setTimeout(() => { if(player) player.justJumped = false; }, 200);
        }
    }
    
    function updateGame() {
        if(!gameActive) return;
        handleInput();
        player.vy += GRAVITY;
        player.x += player.vx;
        player.y += player.vy;
        handleCollisions();
        collectCoins();
        
        if(player.y + player.height >= LAVA_LEVEL) {
            gameActive = false;
            endGame();
            return;
        }
        
        distanceMeters = Math.max(distanceMeters, player.x);
        let targetCam = player.x + player.width/2 - GAME_W/2;
        targetCam = Math.max(0, targetCam);
        cameraX = targetCam;
        generatePlatformsUpTo(cameraX + GAME_W + 500);
        document.getElementById("distanceCounter").innerText = Math.floor(distanceMeters/9);
        document.getElementById("coinCounter").innerText = coinsCollected;
        player.invincibleTimer = Math.max(0, player.invincibleTimer - 1);
    }
    
    function endGame() {
        if(sounds.lava) sounds.lava.pause();
        let finalDist = Math.floor(distanceMeters/9);
        let finalCoins = coinsCollected;
        document.getElementById("finalDistance").innerText = finalDist;
        document.getElementById("finalCoins").innerText = finalCoins;
        document.getElementById("gameOverlay").classList.remove("hidden");
        addScoreEntry(currentPlayerName, finalDist, finalCoins);
    }
    
    function drawMinimal() {
    ctx.fillStyle = "#0a0a0a";
    ctx.fillRect(0, 0, GAME_W, GAME_H);
    
    for(let i = 0; i < GAME_W; i += 40) {
        ctx.beginPath();
        ctx.strokeStyle = "#141414";
        ctx.lineWidth = 0.5;
        ctx.moveTo(i, 0);
        ctx.lineTo(i, LAVA_LEVEL - 10);
        ctx.stroke();
    }
    
    for(let plat of platforms) {
        let sx = plat.x - cameraX;
        if(sx + plat.width < -30 || sx > GAME_W + 50) continue;
        ctx.fillStyle = "#1a1a1a";
        ctx.fillRect(sx, plat.y, plat.width, plat.height);
        ctx.fillStyle = "#222";
        ctx.fillRect(sx + 2, plat.y - 2, plat.width - 4, 3);
        
        if(plat.hasCoin && !plat.coinCollected) {
            let coinX = plat.x + plat.width/2 - COIN_SIZE/2 - cameraX;
            let coinY = plat.y - COIN_SIZE + 4 + Math.sin(Date.now() * 0.008) * 1.5;
            ctx.fillStyle = "#ffffff";
            ctx.beginPath();
            ctx.ellipse(coinX + COIN_SIZE/2, coinY + COIN_SIZE/2, COIN_SIZE/2.2, COIN_SIZE/2.2, 0, 0, Math.PI*2);
            ctx.fill();
            ctx.fillStyle = "#0a0a0a";
            ctx.beginPath();
            ctx.ellipse(coinX + COIN_SIZE/2, coinY + COIN_SIZE/2, COIN_SIZE/3.5, COIN_SIZE/3.5, 0, 0, Math.PI*2);
            ctx.fill();
        }
    }
    
    ctx.fillStyle = "#1c1c1c";
    ctx.fillRect(0, LAVA_LEVEL, GAME_W, GAME_H - LAVA_LEVEL);
    ctx.fillStyle = "#222";
    for(let i=0;i<12;i++) {
        ctx.fillRect(0, LAVA_LEVEL + 2 + i*6, GAME_W, 1);
    }
    
    let px = player.x - cameraX;
    let py = player.y;
    ctx.save();
    let tilt = player.vx * 1.2;
    ctx.translate(px + player.width/2, py + player.height/2);
    ctx.rotate(Math.min(Math.max(tilt * 0.02, -0.1), 0.1));
    ctx.translate(-(px + player.width/2), -(py + player.height/2));
    
    ctx.fillStyle = "#fff";
    ctx.beginPath();
    ctx.rect(px + 4, py + 4, player.width - 8, player.height - 8);
    ctx.fill();
    
    ctx.fillStyle = "#0a0a0a";
    let eyeOffset = 7;
    let eyeXOffset = player.facingRight ? eyeOffset : -eyeOffset;
    
    ctx.beginPath();
    ctx.arc(px + player.width/2 + eyeXOffset, py + player.height/2 - 4, 2.5, 0, Math.PI*2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(px + player.width/2 - eyeXOffset, py + player.height/2 - 4, 2.5, 0, Math.PI*2);
    ctx.fill();
    
    ctx.fillStyle = "#fff";
    ctx.beginPath();
    ctx.arc(px + player.width/2 + eyeXOffset - 1, py + player.height/2 - 5, 0.9, 0, Math.PI*2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(px + player.width/2 - eyeXOffset - 1, py + player.height/2 - 5, 0.9, 0, Math.PI*2);
    ctx.fill();
    
    ctx.restore();
    
    ctx.fillStyle = "#fff";
    ctx.font = "10px monospace";
    ctx.fillText("minimal run", 16, 30);
}
    
    function initMenus() {
        const startBtn = document.getElementById("startGameBtn");
        const restartBtn = document.getElementById("restartBtnGameOver");
        const exitBtn = document.getElementById("exitToMenuBtn");
        const nameInput = document.getElementById("playerNameInput");
        
        startBtn.addEventListener("click", () => {
            if(sounds.button) sounds.button.play().catch(e=>{});
            let newName = nameInput.value.trim();
            if(newName !== "") currentPlayerName = newName;
            else currentPlayerName = "anon";
            resetGame();
        });
        
        restartBtn.addEventListener("click", () => {
            if(sounds.button) sounds.button.play().catch(e=>{});
            resetGame();
        });
        
        exitBtn.addEventListener("click", () => {
            if(sounds.button) sounds.button.play().catch(e=>{});
            gameActive = false;
            if(sounds.lava) sounds.lava.pause();
            document.getElementById("gameOverlay").classList.add("hidden");
            document.getElementById("mainMenu").classList.remove("hidden");
        });
    }
    
    window.addEventListener("load", () => {
        loadLeaderboard();
        initMenus();
        
        function unlockAudio() {
            if(sounds.lava) sounds.lava.play().catch(e=>{});
            document.body.removeEventListener('click', unlockAudio);
        }
        document.body.addEventListener('click', unlockAudio);
        
        window.addEventListener("keydown", (e) => { 
            if(keys.hasOwnProperty(e.code)) { 
                keys[e.code] = true; 
                if(e.code === "Space" || e.code === "KeyW" || e.code === "ArrowUp") e.preventDefault(); 
            } 
        });
        window.addEventListener("keyup", (e) => { 
            if(keys.hasOwnProperty(e.code)) keys[e.code] = false; 
        });
        gameLoop();
    });
})();
