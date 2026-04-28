   // -------- ЗВУКИ --------
const sounds = {
    coin: new Audio('Assets/coin.mp3'),
    lava: new Audio('Assets/Lava.mp3'),
    jump: new Audio('Assets/jump.mp3'),
    button: new Audio('Assets/button.mp3')
};


sounds.lava.loop = true;
sounds.lava.volume = 0.5;

sounds.coin.volume = 0.7;
sounds.jump.volume = 0.6;
sounds.button.volume = 0.4;
   
   (function() {
        const canvas = document.getElementById('gameCanvas');
        const ctx = canvas.getContext('2d');
        
        const GAME_W = 1024, GAME_H = 768;
        const LAVA_LEVEL = 640;
        let cameraX = 0;
        
        let player = {
            x: 250, y: 0,
            vx: 0, vy: 0,
            width: 36, height: 36,
            grounded: false,
            facingRight: true,
            justJumped: false,
            blinkTimer: 0,
            earBounce: 0
        };
        
        // --- Платформы ---
        let platforms = [];
        let coinsCollected = 0;
        let distanceMeters = 0;
        let gameActive = false;
        let currentPlayerName = "Пушистик";
        
        const MIN_GAP = 90;     
        const MAX_GAP = 320;
        const MIN_WIDTH = 65;
        const MAX_WIDTH = 170;
        const PLATFORM_HEIGHT = 22;
        const COIN_SIZE = 20;
        
        const GRAVITY = 0.68;
        const JUMP_POWER = -15.2;
        const MOVE_ACC = 0.85;
        const GROUND_FRICTION = 0.96;
        const AIR_CONTROL = 0.99;
        const MAX_SPEED = 7.2;
        

        let leaderboard = [];
        
        function loadLeaderboard() {
            const stored = localStorage.getItem("lavaLeaderboardCute");
            if(stored) {
                try { leaderboard = JSON.parse(stored); } catch(e){ leaderboard = []; }
            }
            if(!leaderboard || leaderboard.length === 0) {
                leaderboard = [
                    {name:"Пушистик", distance:245, coins:12},
                    {name:"Лисёнок", distance:189, coins:8},
                    {name:"Хвостик", distance:143, coins:6}
                ];
                saveLeaderboard();
            }
            leaderboard.sort((a,b)=>b.distance - a.distance || b.coins - a.coins);
            if(leaderboard.length > 10) leaderboard = leaderboard.slice(0,10);
            updateLeaderboardUI();
        }
        
        function saveLeaderboard() {
            localStorage.setItem("lavaLeaderboardCute", JSON.stringify(leaderboard.slice(0,10)));
        }
        
        function addScoreEntry(name, distance, coins) {
            if(!name || name.trim() === "") name = "Пушистик";
            leaderboard.push({name: name.trim(), distance: Math.floor(distance), coins: coins});
            leaderboard.sort((a,b)=>b.distance - a.distance || b.coins - a.coins);
            if(leaderboard.length > 10) leaderboard = leaderboard.slice(0,10);
            saveLeaderboard();
            updateLeaderboardUI();
        }
        
        function updateLeaderboardUI() {
            const listEl = document.getElementById("leaderboardList");
            if(listEl) {
                if(leaderboard.length===0) { listEl.innerHTML = "<li>⭐ Нет данных ⭐</li>"; return; }
                let html = "";
                for(let i=0; i<leaderboard.length; i++) {
                    const entry = leaderboard[i];
                    html += `<li>${i+1}. ${entry.name} — ${entry.distance}м  🪙${entry.coins}</li>`;
                }
                listEl.innerHTML = html;
            }
        }
        
        // --- Генерация платформ ---
        function generatePlatformsUpTo(limitX) {
            if(platforms.length === 0) {
                platforms.push({ x: 200, y: LAVA_LEVEL - 32, width: 120, height: PLATFORM_HEIGHT, hasCoin: false, coinCollected: false });
                worldRightmost = 200 + 120;
            }
            
            while(worldRightmost < limitX + 800) {
                let lastPlat = platforms[platforms.length-1];
                let gap = MIN_GAP + Math.random() * (MAX_GAP - MIN_GAP);
                let newX = lastPlat.x + lastPlat.width + gap;
                let yOffset = Math.random() * 65 - 32;
                let newY = LAVA_LEVEL - 40 + yOffset;
                newY = Math.min(LAVA_LEVEL - 20, Math.max(LAVA_LEVEL - 100, newY));
                let newWidth = MIN_WIDTH + Math.random() * (MAX_WIDTH - MIN_WIDTH);
                let hasCoin = false;
                let platIndex = platforms.length;
                if((platIndex + 1) % 5 === 0) hasCoin = true;
                
                platforms.push({
                    x: newX, y: newY, width: newWidth, height: PLATFORM_HEIGHT,
                    hasCoin: hasCoin, coinCollected: false
                });
                worldRightmost = newX + newWidth;
            }
        }
        
        let worldRightmost = 500;
        
        function handleCollisions() {
            player.grounded = false;
            for(let plat of platforms) {
                if(player.vy >= 0) {
                    if(player.x + player.width > plat.x && player.x < plat.x + plat.width &&
                        player.y + player.height <= plat.y + 12 && player.y + player.height + player.vy >= plat.y) {
                        player.y = plat.y - player.height;
                        player.vy = 0;
                        player.grounded = true;
                        player.justJumped = false;
                    }
                }
                if(player.y + player.height > plat.y && player.y < plat.y + plat.height) {
                    if(player.x + player.width > plat.x && player.x < plat.x + plat.width && player.vy > 0) {
                        if(player.y + player.height - player.vy <= plat.y + 10) {
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
                    let coinY = plat.y - COIN_SIZE + 6;
                    if(player.x < coinX + COIN_SIZE && player.x + player.width > coinX &&
                player.y < coinY + COIN_SIZE && player.y + player.height > coinY) {
                plat.coinCollected = true;
                coinsCollected++;
                updateUI();
                
                sounds.coin.currentTime = 0;
                sounds.coin.play().catch(e => console.log('Audio error:', e));
            }
        }
    }
}
        
        function resetGame() {
    sounds.lava.pause();
    sounds.lava.currentTime = 0;
    
    platforms = [];
    coinsCollected = 0;
    distanceMeters = 0;
    cameraX = 0;
    player = {
        x: 250, y: 0, vx: 0, vy: 0, width: 36, height: 36,
        grounded: false, facingRight: true, justJumped: false, blinkTimer: 0
    };
    gameActive = true;
    worldRightmost = 500;
    generatePlatformsUpTo(1300);
    if(platforms.length) {
        let startPlat = platforms[0];
        player.x = startPlat.x + 15;
        player.y = startPlat.y - player.height;
        player.vy = 0;
        player.vx = 0;
    }
    updateUI();
    document.getElementById("gameOverlay").classList.add("hidden");
    document.getElementById("mainMenu").classList.add("hidden");
    document.getElementById("gameUI").classList.add("visible");
    
    // ===== ЗАПУСКАЕМ МУЗЫКУ ЛАВЫ =====
    sounds.lava.play().catch(e => console.log('Audio error:', e));
}
        
        function updateUI() {
            document.getElementById("coinCounter").innerText = coinsCollected;
            document.getElementById("distanceCounter").innerText = Math.floor(distanceMeters / 10);
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
        if(player.grounded) {
            player.vx *= GROUND_FRICTION;
        } else {
            player.vx *= AIR_CONTROL;
        }
    }
    
    let jump = (keys.Space || keys.KeyW || keys.ArrowUp) && !prevJumpPressed;
    prevJumpPressed = (keys.Space || keys.KeyW || keys.ArrowUp);
    if(jump && player.grounded) {
        player.vy = JUMP_POWER;
        player.grounded = false;
        player.justJumped = true;
        
        sounds.jump.currentTime = 0;
        sounds.jump.play().catch(e => console.log('Audio error:', e));
        
        setTimeout(() => { if(player) player.justJumped = false; }, 250);
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
            
            generatePlatformsUpTo(cameraX + GAME_W + 600);
            
            document.getElementById("distanceCounter").innerText = Math.floor(distanceMeters/10);
            document.getElementById("coinCounter").innerText = coinsCollected;
            
            player.blinkTimer++;
        }
        
        function endGame() {
    sounds.lava.pause();
    
    let finalDist = Math.floor(distanceMeters/10);
    let finalCoins = coinsCollected;
    document.getElementById("finalDistance").innerText = finalDist;
    document.getElementById("finalCoins").innerText = finalCoins;
    document.getElementById("gameOverlay").classList.remove("hidden");
    addScoreEntry(currentPlayerName, finalDist, finalCoins);
}
        
        let jumpParticles = [];
        
        function addJumpDust() {
            if(player.justJumped && player.grounded === false) {
                for(let i=0;i<6;i++) {
                    jumpParticles.push({
                        x: player.x + player.width/2,
                        y: player.y + player.height - 5,
                        vx: (Math.random() - 0.5) * 3,
                        vy: Math.random() * 2 + 1,
                        life: 0.7
                    });
                }
            }
            for(let i=0;i<jumpParticles.length;i++) {
                jumpParticles[i].x += jumpParticles[i].vx;
                jumpParticles[i].y += jumpParticles[i].vy;
                jumpParticles[i].life -= 0.03;
                if(jumpParticles[i].life <= 0) {
                    jumpParticles.splice(i,1);
                    i--;
                }
            }
        }
        
        function drawCuteCharacter(x, y, width, height, facingRight, isJumping, blink) {
            const centerX = x + width/2;
            const centerY = y + height/2;
            const bodyW = width * 0.85;
            const bodyH = height * 0.75;
            
            const grad = ctx.createRadialGradient(centerX-5, centerY-3, 5, centerX, centerY, bodyW/1.5);
            grad.addColorStop(0, '#F9C6A0');
            grad.addColorStop(1, '#E8A87C');
            ctx.fillStyle = grad;
            ctx.beginPath();
            ctx.ellipse(centerX, centerY + height*0.05, bodyW/2, bodyH/2, 0, 0, Math.PI*2);
            ctx.fill();
            
            ctx.fillStyle = '#FFB7B2';
            ctx.beginPath();
            ctx.ellipse(centerX - width*0.28, centerY + height*0.1, 7, 5, 0, 0, Math.PI*2);
            ctx.fill();
            ctx.beginPath();
            ctx.ellipse(centerX + width*0.28, centerY + height*0.1, 7, 5, 0, 0, Math.PI*2);
            ctx.fill();
            
            const earOffset = width * 0.35;
            const earBounce = Math.sin(Date.now() * 0.012) * 1.5;
            // Левое ушко
            ctx.fillStyle = '#D28C5C';
            ctx.beginPath();
            ctx.moveTo(centerX - earOffset - 3, centerY - height*0.35 + earBounce);
            ctx.lineTo(centerX - earOffset - 12, centerY - height*0.6 + earBounce);
            ctx.lineTo(centerX - earOffset + 4, centerY - height*0.45 + earBounce);
            ctx.fill();
            ctx.fillStyle = '#F0A87A';
            ctx.beginPath();
            ctx.moveTo(centerX - earOffset - 5, centerY - height*0.38 + earBounce);
            ctx.lineTo(centerX - earOffset - 10, centerY - height*0.55 + earBounce);
            ctx.lineTo(centerX - earOffset + 2, centerY - height*0.43 + earBounce);
            ctx.fill();
            
            ctx.fillStyle = '#D28C5C';
            ctx.beginPath();
            ctx.moveTo(centerX + earOffset + 3, centerY - height*0.35 + earBounce);
            ctx.lineTo(centerX + earOffset + 12, centerY - height*0.6 + earBounce);
            ctx.lineTo(centerX + earOffset - 4, centerY - height*0.45 + earBounce);
            ctx.fill();
            ctx.fillStyle = '#F0A87A';
            ctx.beginPath();
            ctx.moveTo(centerX + earOffset + 5, centerY - height*0.38 + earBounce);
            ctx.lineTo(centerX + earOffset + 10, centerY - height*0.55 + earBounce);
            ctx.lineTo(centerX + earOffset - 2, centerY - height*0.43 + earBounce);
            ctx.fill();
            
            const eyeOffsetX = width * 0.22;
            const eyeY = centerY - height*0.05;
            const isBlinking = blink < 30;
            
            if(isBlinking) {

                ctx.fillStyle = '#5D3A1A';
                ctx.fillRect(centerX - eyeOffsetX - 4, eyeY-2, 8, 3);
                ctx.fillRect(centerX + eyeOffsetX - 4, eyeY-2, 8, 3);
            } else {

                ctx.fillStyle = 'white';
                ctx.beginPath();
                ctx.ellipse(centerX - eyeOffsetX, eyeY, 6, 7, 0, 0, Math.PI*2);
                ctx.fill();
                ctx.beginPath();
                ctx.ellipse(centerX + eyeOffsetX, eyeY, 6, 7, 0, 0, Math.PI*2);
                ctx.fill();

                let pupilOffsetX = facingRight ? 2 : -2;
                ctx.fillStyle = '#2C1810';
                ctx.beginPath();
                ctx.arc(centerX - eyeOffsetX + pupilOffsetX, eyeY, 3, 0, Math.PI*2);
                ctx.fill();
                ctx.beginPath();
                ctx.arc(centerX + eyeOffsetX + pupilOffsetX, eyeY, 3, 0, Math.PI*2);
                ctx.fill();

                ctx.fillStyle = 'white';
                ctx.beginPath();
                ctx.arc(centerX - eyeOffsetX + pupilOffsetX - 1.2, eyeY - 1.2, 1, 0, Math.PI*2);
                ctx.fill();
                ctx.beginPath();
                ctx.arc(centerX + eyeOffsetX + pupilOffsetX - 1.2, eyeY - 1.2, 1, 0, Math.PI*2);
                ctx.fill();
            }
            
            ctx.fillStyle = '#FF8A7A';
            ctx.beginPath();
            ctx.ellipse(centerX, centerY + height*0.08, 3, 2.5, 0, 0, Math.PI*2);
            ctx.fill();
            
            ctx.beginPath();
            ctx.arc(centerX, centerY + height*0.15, 9, 0.05, Math.PI - 0.05);
            ctx.strokeStyle = '#8B5A3A';
            ctx.lineWidth = 2;
            ctx.stroke();
            
            ctx.beginPath();
            ctx.moveTo(centerX + width*0.12, centerY + height*0.07);
            ctx.lineTo(centerX + width*0.28, centerY + height*0.05);
            ctx.moveTo(centerX + width*0.12, centerY + height*0.11);
            ctx.lineTo(centerX + width*0.28, centerY + height*0.12);
            ctx.moveTo(centerX - width*0.12, centerY + height*0.07);
            ctx.lineTo(centerX - width*0.28, centerY + height*0.05);
            ctx.moveTo(centerX - width*0.12, centerY + height*0.11);
            ctx.lineTo(centerX - width*0.28, centerY + height*0.12);
            ctx.strokeStyle = '#A0704A';
            ctx.lineWidth = 1.2;
            ctx.stroke();
            
            ctx.fillStyle = '#E8A87C';
            ctx.beginPath();
            ctx.ellipse(centerX - width*0.48, centerY + height*0.15, 8, 6, -0.5, 0, Math.PI*2);
            ctx.fill();
            ctx.fillStyle = '#D28C5C';
            ctx.beginPath();
            ctx.ellipse(centerX - width*0.53, centerY + height*0.12, 5, 4, -0.3, 0, Math.PI*2);
            ctx.fill();
        }
        
        function draw() {
            ctx.clearRect(0, 0, GAME_W, GAME_H);
            
            // Небо
            const gradSky = ctx.createLinearGradient(0, 0, 0, 500);
            gradSky.addColorStop(0, "#1a0a1c");
            gradSky.addColorStop(1, "#3a1a2a");
            ctx.fillStyle = gradSky;
            ctx.fillRect(0, 0, GAME_W, LAVA_LEVEL-20);
            
            // Звёздочки/искорки
            for(let i=0;i<80;i++) {
                ctx.fillStyle = `rgba(255, 180, 80, ${0.2+Math.sin(Date.now()*0.002+i)*0.1})`;
                ctx.beginPath();
                ctx.arc((i*97 + cameraX*0.2)%(GAME_W+200)-100, 70 + Math.sin(i)*30, 2, 0, Math.PI*2);
                ctx.fill();
            }
            
            // Лава
            ctx.fillStyle = "#d43f0a";
            ctx.fillRect(0, LAVA_LEVEL, GAME_W, GAME_H - LAVA_LEVEL);
            for(let i=0; i<30; i++) {
                let waveHeight = 8 + Math.sin(Date.now()*0.003 + i)*5;
                let yPos = LAVA_LEVEL + waveHeight/2;
                ctx.beginPath();
                ctx.moveTo(0, yPos);
                for(let x=0; x<GAME_W; x+=40) {
                    let offset = Math.sin(x*0.02 + Date.now()*0.006 + i)*6;
                    ctx.lineTo(x, yPos + offset);
                }
                ctx.lineTo(GAME_W, yPos+5);
                ctx.lineTo(GAME_W, LAVA_LEVEL+30);
                ctx.lineTo(0, LAVA_LEVEL+30);
                ctx.fillStyle = `rgba(255, 80, 20, ${0.3 - i*0.01})`;
                ctx.fill();
            }
            for(let i=0;i<25;i++) {
                let bubbleX = (i*73 + Date.now()*0.4) % GAME_W;
                let bubbleY = LAVA_LEVEL + 15 + Math.sin(Date.now()*0.003 + i)*8;
                ctx.beginPath();
                ctx.arc(bubbleX, bubbleY, 3+Math.sin(Date.now()*0.01+i), 0, Math.PI*2);
                ctx.fillStyle = `rgba(255, 160, 50, 0.7)`;
                ctx.fill();
            }
            
            // Платформы
            for(let plat of platforms) {
                let screenX = plat.x - cameraX;
                if(screenX + plat.width < -50 || screenX > GAME_W+100) continue;
                ctx.fillStyle = "#3a1f0a";
                ctx.fillRect(screenX+4, plat.y+6, plat.width, plat.height);
                let grad = ctx.createLinearGradient(screenX, plat.y, screenX+plat.width, plat.y+plat.height);
                grad.addColorStop(0, "#7a4a2a");
                grad.addColorStop(1, "#5a2e1a");
                ctx.fillStyle = grad;
                ctx.fillRect(screenX, plat.y, plat.width, plat.height);
                ctx.fillStyle = "#a56a3a";
                ctx.fillRect(screenX+5, plat.y-4, plat.width-10, 6);
                ctx.fillStyle = "#2a1a0a";
                ctx.fillRect(screenX+10, plat.y+5, 8, 5);
                ctx.fillRect(screenX+plat.width-20, plat.y+8, 10, 4);
                
                if(plat.hasCoin && !plat.coinCollected) {
                    let coinX = plat.x + plat.width/2 - COIN_SIZE/2 - cameraX;
                    let coinY = plat.y - COIN_SIZE + 5 + Math.sin(Date.now()*0.008)*2;
                    ctx.shadowBlur = 12;
                    ctx.fillStyle = "#FFD966";
                    ctx.beginPath();
                    ctx.ellipse(coinX+COIN_SIZE/2, coinY+COIN_SIZE/2, COIN_SIZE/2, COIN_SIZE/2, 0, 0, Math.PI*2);
                    ctx.fill();
                    ctx.fillStyle = "#e5b800";
                    ctx.beginPath();
                    ctx.ellipse(coinX+COIN_SIZE/2, coinY+COIN_SIZE/2, COIN_SIZE/2.5, COIN_SIZE/2.5, 0, 0, Math.PI*2);
                    ctx.fill();
                    ctx.fillStyle = "gold";
                    ctx.font = "bold 16px monospace";
                    ctx.fillText("★", coinX+6, coinY+16);
                    ctx.shadowBlur = 0;
                }
            }
            
            addJumpDust();
            for(let p of jumpParticles) {
                let sx = p.x - cameraX;
                let sy = p.y;
                ctx.fillStyle = `rgba(255, 200, 100, ${p.life})`;
                ctx.beginPath();
                ctx.arc(sx, sy, 3, 0, Math.PI*2);
                ctx.fill();
            }
            

            let px = player.x - cameraX;
            let py = player.y;
            ctx.save();

            let tilt = player.vx * 1.5;
            ctx.translate(px + player.width/2, py + player.height/2);
            ctx.rotate(Math.min(Math.max(tilt * 0.03, -0.15), 0.15));
            ctx.translate(-(px + player.width/2), -(py + player.height/2));
            
            drawCuteCharacter(px, py, player.width, player.height, player.facingRight, !player.grounded, player.blinkTimer % 80 < 5);
            ctx.restore();
        }
        
        function gameLoop() {
            if(gameActive) updateGame();
            draw();
            requestAnimationFrame(gameLoop);
        }
        
        function initMenus() {
    const startBtn = document.getElementById("startGameBtn");
    const restartBtn = document.getElementById("restartBtnGameOver");
    const exitBtn = document.getElementById("exitToMenuBtn");
    const nameInput = document.getElementById("playerNameInput");
    
    startBtn.addEventListener("click", () => {

        sounds.button.currentTime = 0;
        sounds.button.play().catch(e => console.log('Audio error:', e));
        
        let newName = nameInput.value.trim();
        if(newName !== "") currentPlayerName = newName;
        else currentPlayerName = "Пушистик";
        resetGame();
    });
    
    restartBtn.addEventListener("click", () => {

        sounds.button.currentTime = 0;
        sounds.button.play().catch(e => console.log('Audio error:', e));
        
        resetGame();
    });
    
    exitBtn.addEventListener("click", () => {

        sounds.button.currentTime = 0;
        sounds.button.play().catch(e => console.log('Audio error:', e));
        
        gameActive = false;
        sounds.lava.pause();
        
        document.getElementById("gameOverlay").classList.add("hidden");
        document.getElementById("mainMenu").classList.remove("hidden");
        document.getElementById("gameUI").classList.remove("visible");
    });
}
        
        window.addEventListener("load", () => {
    loadLeaderboard();
    initMenus();
    
    function unlockAudio() {
        sounds.lava.play().catch(e => console.log('Audio play error:', e));
        document.body.removeEventListener('click', unlockAudio);
    }
    document.body.addEventListener('click', unlockAudio);
    

    sounds.lava.currentTime = 0;
    sounds.lava.play().catch(e => console.log('Audio play error. Click on page to enable audio.'));
    
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
