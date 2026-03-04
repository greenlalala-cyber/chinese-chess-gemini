/**
 * 冠冠中國象棋 (Xiangqi) 完整邏輯
 * 包含：大小盤規則、暗吃/連吃、自動存檔、手動將軍勝利、AI
 */

// --- 常數定義 ---
const PIECE_TYPES = {
    G: { nameR: '帥', nameB: '將', rank: 7 },
    A: { nameR: '仕', nameB: '士', rank: 6 },
    E: { nameR: '相', nameB: '象', rank: 5 },
    R: { nameR: '車', nameB: '車', rank: 4 },
    H: { nameR: '馬', nameB: '馬', rank: 3 },
    C: { nameR: '炮', nameB: '包', rank: 2 },
    S: { nameR: '兵', nameB: '卒', rank: 1 }
};

// 小盤固定 32 顆棋子的起始座標 (9x5 盤面，前4列，第5列空)
const HALF_BOARD_POSITIONS = [
    {x:0, y:0}, {x:1, y:0}, {x:2, y:0}, {x:3, y:0}, {x:4, y:0}, {x:5, y:0}, {x:6, y:0}, {x:7, y:0}, {x:8, y:0},
    {x:0, y:1}, {x:1, y:1}, {x:2, y:1}, {x:3, y:1}, {x:4, y:1}, {x:5, y:1}, {x:6, y:1}, {x:7, y:1}, {x:8, y:1},
    {x:0, y:2}, {x:1, y:2}, {x:2, y:2}, {x:3, y:2}, {x:4, y:2}, {x:5, y:2}, {x:6, y:2}, {x:7, y:2}, {x:8, y:2},
    {x:2, y:3}, {x:3, y:3}, {x:4, y:3}, {x:5, y:3}, {x:6, y:3}
];

// 遊戲狀態與設定
let game = {
    mode: 'pvc', // pvc, pvp
    boardType: 'full', // full, half
    cpuLevel: 1,
    turn: 'red',
    board: [], // 2D array [x][y]
    pieces: [],
    selectedPiece: null,
    rules: { darkCapture: true, chainCapture: true, hints: true, dangerZone: false },
    chainPieceId: null, // 用於連吃鎖定
    canClaimWin: false, // 處於將軍狀態
    isGameOver: false
};

// --- DOM 元素綁定 ---
const UI = {
    menu: document.getElementById('main-menu'),
    saveModal: document.getElementById('save-prompt-modal'),
    diceModal: document.getElementById('dice-modal'),
    gameContainer: document.getElementById('game-container'),
    board: document.getElementById('board'),
    turnIndicator: document.getElementById('turn-indicator'),
    chainStatus: document.getElementById('chain-status'),
    btnClaimWin: document.getElementById('btn-claim-win'),
    gameOverModal: document.getElementById('game-over-modal'),
    winMessage: document.getElementById('win-message')
};

// --- 初始化與存檔處理 ---
window.onload = () => {
    const saved = localStorage.getItem('xiangqi_save');
    if (saved) {
        UI.saveModal.classList.remove('hidden');
    } else {
        UI.menu.classList.remove('hidden');
    }

    // 選單聯動
    document.getElementById('select-board-type').addEventListener('change', (e) => {
        document.getElementById('half-board-rules').style.display = e.target.value === 'half' ? 'block' : 'none';
    });
    document.getElementById('select-mode').addEventListener('change', (e) => {
        document.getElementById('cpu-level-section').style.display = e.target.value === 'pvc' ? 'block' : 'none';
    });
};

document.getElementById('btn-resume').addEventListener('click', () => {
    loadGame();
    UI.saveModal.classList.add('hidden');
    startGameUI();
});

document.getElementById('btn-new-game-prompt').addEventListener('click', () => {
    localStorage.removeItem('xiangqi_save');
    UI.saveModal.classList.add('hidden');
    UI.menu.classList.remove('hidden');
});

document.getElementById('btn-start-game').addEventListener('click', () => {
    setupNewGame();
});

document.getElementById('btn-quit').addEventListener('click', () => {
    saveGame();
    location.reload(); // 簡單重啟
});

document.getElementById('btn-back-menu').addEventListener('click', () => {
    localStorage.removeItem('xiangqi_save');
    location.reload();
});

// --- 遊戲設定 ---
function setupNewGame() {
    game.mode = document.getElementById('select-mode').value;
    game.boardType = document.getElementById('select-board-type').value;
    game.cpuLevel = parseInt(document.getElementById('select-cpu-level').value);
    game.rules.darkCapture = document.getElementById('chk-dark-capture').checked;
    game.rules.chainCapture = document.getElementById('chk-chain-capture').checked;
    
    // 設定遊戲內 UI 同步
    document.getElementById('in-chk-dark').checked = game.rules.darkCapture;
    document.getElementById('in-chk-chain').checked = game.rules.chainCapture;
    document.getElementById('in-half-rules').classList.toggle('hidden', game.boardType === 'full');

    const firstPlayerMethod = document.getElementById('select-first-player').value;
    UI.menu.classList.add('hidden');

    if (firstPlayerMethod === 'manual_red') { startGameTurn('red'); }
    else if (firstPlayerMethod === 'manual_black') { startGameTurn('black'); }
    else if (firstPlayerMethod === 'random') { startGameTurn(Math.random() < 0.5 ? 'red' : 'black'); }
    else if (firstPlayerMethod === 'dice') { startDiceMiniGame(); }
}

function startGameTurn(firstColor) {
    game.turn = firstColor;
    game.isGameOver = false;
    game.chainPieceId = null;
    initBoard();
    startGameUI();
    saveGame();
    checkAutoMove();
}

function startGameUI() {
    UI.gameContainer.classList.remove('hidden');
    renderBoard();
    updateUI();
}

// --- 骰子系統 ---
let diceState = { red: 0, black: 0, current: null, interval: null };

function startDiceMiniGame() {
    UI.diceModal.classList.remove('hidden');
    document.getElementById('dice-status').innerText = '紅方擲骰...';
    rollDice('red');
}

function rollDice(color) {
    diceState.current = color;
    const valElem = document.querySelector(`#dice-${color} .dice-value`);
    const btnElem = document.getElementById(`btn-stop-dice-${color}`);
    
    // CPU自動停骰
    if (game.mode === 'pvc' && color === 'black') {
        btnElem.classList.add('hidden');
        diceState.interval = setInterval(() => { valElem.innerText = Math.floor(Math.random()*6)+1; }, 50);
        setTimeout(() => stopDice('black'), 1500);
    } else {
        btnElem.classList.remove('hidden');
        diceState.interval = setInterval(() => { valElem.innerText = Math.floor(Math.random()*6)+1; }, 50);
        btnElem.onclick = () => stopDice(color);
    }
}

function stopDice(color) {
    clearInterval(diceState.interval);
    const btnElem = document.getElementById(`btn-stop-dice-${color}`);
    btnElem.classList.add('hidden');
    
    let result = Math.floor(Math.random() * 6) + 1;
    // CPU 難度作弊 (越高越容易出6)
    if (color === 'black' && game.mode === 'pvc') {
        const cheatChance = (game.cpuLevel - 1) * 0.15; // L1:0%, L4:45%
        if (Math.random() < cheatChance) result = 6;
    }
    
    document.querySelector(`#dice-${color} .dice-value`).innerText = result;
    diceState[color] = result;

    if (color === 'red') {
        document.getElementById('dice-status').innerText = '黑方擲骰...';
        setTimeout(() => rollDice('black'), 500);
    } else {
        // 判定勝負
        if (diceState.red === diceState.black) {
            document.getElementById('dice-status').innerText = '平手！重新擲骰...';
            setTimeout(() => {
                document.querySelector(`#dice-red .dice-value`).innerText = '?';
                document.querySelector(`#dice-black .dice-value`).innerText = '?';
                rollDice('red');
            }, 1500);
        } else {
            const winner = diceState.red > diceState.black ? 'red' : 'black';
            document.getElementById('dice-status').innerText = `${winner === 'red' ? '紅' : '黑'}方先手！`;
            setTimeout(() => {
                UI.diceModal.classList.add('hidden');
                startGameTurn(winner);
            }, 1500);
        }
    }
}

// --- 棋盤與棋子初始化 ---
function initBoard() {
    const cols = 9;
    const rows = game.boardType === 'full' ? 10 : 5;
    game.board = Array(cols).fill(null).map(() => Array(rows).fill(null));
    game.pieces = [];

    if (game.boardType === 'full') {
        // 大盤標準配置
        const setup = [
            {type:'R', coords:[[0,0], [8,0], [0,9], [8,9]]},
            {type:'H', coords:[[1,0], [7,0], [1,9], [7,9]]},
            {type:'E', coords:[[2,0], [6,0], [2,9], [6,9]]},
            {type:'A', coords:[[3,0], [5,0], [3,9], [5,9]]},
            {type:'G', coords:[[4,0], [4,9]]},
            {type:'C', coords:[[1,2], [7,2], [1,7], [7,7]]},
            {type:'S', coords:[[0,3],[2,3],[4,3],[6,3],[8,3], [0,6],[2,6],[4,6],[6,6],[8,6]]}
        ];
        let idCounter = 1;
        setup.forEach(group => {
            group.coords.forEach(pos => {
                const color = pos[1] < 5 ? 'black' : 'red';
                const p = { id: idCounter++, type: group.type, color, x: pos[0], y: pos[1], revealed: true };
                game.pieces.push(p);
                game.board[p.x][p.y] = p;
            });
        });
    } else {
        // 小盤全蓋配置
        let pool = [];
        ['red', 'black'].forEach(color => {
            pool.push({type:'G', color});
            for(let i=0;i<2;i++) pool.push({type:'A', color});
            for(let i=0;i<2;i++) pool.push({type:'E', color});
            for(let i=0;i<2;i++) pool.push({type:'R', color});
            for(let i=0;i<2;i++) pool.push({type:'H', color});
            for(let i=0;i<2;i++) pool.push({type:'C', color});
            for(let i=0;i<5;i++) pool.push({type:'S', color});
        });
        pool.sort(() => Math.random() - 0.5); // Shuffle

        for (let i = 0; i < 32; i++) {
            const pos = HALF_BOARD_POSITIONS[i];
            const p = { ...pool[i], id: i+1, x: pos.x, y: pos.y, revealed: false };
            game.pieces.push(p);
            game.board[p.x][p.y] = p;
        }
    }
}

// --- 渲染 ---
function renderBoard() {
    UI.board.innerHTML = '';
    const cols = 9;
    const rows = game.boardType === 'full' ? 10 : 5;
    UI.board.className = game.boardType === 'full' ? 'grid-full' : 'grid-half';

    // 建立棋格背景
    for (let y = 0; y < rows; y++) {
        for (let x = 0; x < cols; x++) {
            const cell = document.createElement('div');
            cell.className = 'cell';
            if (x === 0) cell.classList.add('edge-left');
            if (x === cols - 1) cell.classList.add('edge-right');
            if (y === 0) cell.classList.add('edge-top');
            if (y === rows - 1) cell.classList.add('edge-bottom');
            if (game.boardType === 'full' && y === 4) cell.classList.add('river-top');
            if (game.boardType === 'full' && y === 5) cell.classList.add('river-bottom');
            
            cell.dataset.x = x; cell.dataset.y = y;
            cell.onclick = () => handleCellClick(x, y);
            UI.board.appendChild(cell);
        }
    }

    // 建立棋子
    game.pieces.forEach(p => {
        const pElem = document.createElement('div');
        pElem.id = `piece-${p.id}`;
        pElem.className = `piece ${p.revealed ? p.color : 'hidden-piece'}`;
        pElem.innerText = p.revealed ? PIECE_TYPES[p.type][p.color === 'red' ? 'nameR' : 'nameB'] : '';
        pElem.style.left = `${p.x * 60 + 5}px`; // 5px padding for 50px piece in 60px cell
        pElem.style.top = `${p.y * 60 + 5}px`;
        pElem.onclick = (e) => { e.stopPropagation(); handlePieceClick(p); };
        
        if (game.selectedPiece && game.selectedPiece.id === p.id) {
            pElem.classList.add('selected');
        }
        UI.board.appendChild(pElem);
    });

    renderHints();
}

function renderHints() {
    // 移除舊提示
    document.querySelectorAll('.cell.highlight, .cell.danger').forEach(e => {
        e.classList.remove('highlight', 'danger');
    });

    if (game.rules.hints && game.selectedPiece) {
        const moves = getValidMoves(game.selectedPiece);
        moves.forEach(m => {
            const cell = document.querySelector(`.cell[data-x="${m.x}"][data-y="${m.y}"]`);
            if (cell) cell.classList.add('highlight');
        });
    }

    if (game.rules.dangerZone) {
        const dangerMoves = getDangerZone(game.turn);
        dangerMoves.forEach(m => {
            const cell = document.querySelector(`.cell[data-x="${m.x}"][data-y="${m.y}"]`);
            if (cell) cell.classList.add('danger');
        });
    }
}

function updateUI() {
    UI.turnIndicator.innerText = `輪到：${game.turn === 'red' ? '紅方' : '黑方'}`;
    UI.turnIndicator.style.color = game.turn === 'red' ? '#d32f2f' : '#1976d2';
    
    UI.chainStatus.classList.toggle('hidden', !game.chainPieceId);
    UI.btnClaimWin.classList.toggle('hidden', !game.canClaimWin);
}

// --- 遊戲中設定切換 ---
document.querySelectorAll('.ingame-settings input').forEach(input => {
    input.addEventListener('change', () => {
        game.rules.hints = document.getElementById('in-chk-hints').checked;
        game.rules.dangerZone = document.getElementById('in-chk-danger').checked;
        game.rules.darkCapture = document.getElementById('in-chk-dark').checked;
        game.rules.chainCapture = document.getElementById('in-chk-chain').checked;
        
        // 如果關閉連吃且當前在連吃狀態，強制結束回合
        if (!game.rules.chainCapture && game.chainPieceId) {
            game.chainPieceId = null;
            switchTurn();
        }
        renderBoard();
        saveGame();
    });
});

// --- 互動邏輯 ---
function handlePieceClick(clickedPiece) {
    if (game.isGameOver) return;
    if (game.mode === 'pvc' && game.turn === 'black') return; // 鎖定CPU回合

    // 連吃鎖定
    if (game.chainPieceId && clickedPiece.id !== game.chainPieceId) {
        // 如果點擊了非連吃對象且是敵方/未翻開，視為嘗試攻擊
        if (clickedPiece.color !== game.turn || !clickedPiece.revealed) {
            const activePiece = game.pieces.find(p => p.id === game.chainPieceId);
            if(activePiece) executeMove(activePiece, clickedPiece.x, clickedPiece.y);
        }
        return;
    }

    // 翻牌邏輯 (小盤)
    if (!clickedPiece.revealed) {
        if (game.selectedPiece) {
            // 嘗試暗吃
            executeMove(game.selectedPiece, clickedPiece.x, clickedPiece.y);
        } else if (!game.chainPieceId) {
            // 單純翻牌 (不能在連吃狀態翻牌)
            clickedPiece.revealed = true;
            switchTurn();
        }
        return;
    }

    // 選取己方棋子
    if (clickedPiece.color === game.turn) {
        game.selectedPiece = clickedPiece;
        renderBoard();
    } else if (game.selectedPiece) {
        // 吃子
        executeMove(game.selectedPiece, clickedPiece.x, clickedPiece.y);
    }
}

function handleCellClick(x, y) {
    if (game.isGameOver || (game.mode === 'pvc' && game.turn === 'black')) return;
    if (game.selectedPiece) {
        executeMove(game.selectedPiece, x, y);
    }
}

// --- 移動與規則引擎 ---
function getValidMoves(piece) {
    let moves = [];
    if (!piece.revealed) return moves;

    const addIfValid = (x, y) => {
        if (x < 0 || x > 8 || y < 0 || y > (game.boardType === 'full' ? 9 : 4)) return false;
        const target = game.board[x][y];
        
        // 判斷是否為友軍 (暗棋未翻開不算明確友軍，可嘗試走)
        if (target && target.revealed && target.color === piece.color) return false;
        
        // 大盤規則限制
        if (game.boardType === 'full') {
            if (piece.type === 'G' && (x < 3 || x > 5 || (piece.color === 'black' ? y > 2 : y < 7))) return false;
            if (piece.type === 'A' && (x < 3 || x > 5 || (piece.color === 'black' ? y > 2 : y < 7))) return false;
            if (piece.type === 'E' && (piece.color === 'black' ? y > 4 : y < 5)) return false; // 不過河
        }
        
        moves.push({x, y});
        return true;
    };

    const px = piece.x, py = piece.y;

    if (game.boardType === 'half') {
        // 小盤：除砲外，皆可1步正交移動 (加上砲標準走法)
        if (piece.type !== 'C') {
            [[0,1], [0,-1], [1,0], [-1,0]].forEach(d => {
                if(piece.type === 'E' || piece.type === 'A') { // 象/士在小盤可斜走
                    [[1,1], [1,-1], [-1,1], [-1,-1]].forEach(dd => addIfValid(px+dd[0], py+dd[1]));
                } else {
                    addIfValid(px+d[0], py+d[1]);
                }
            });
        }
    }

    if (piece.type === 'G' && game.boardType === 'full') {
        [[0,1], [0,-1], [1,0], [-1,0]].forEach(d => addIfValid(px+d[0], py+d[1]));
        // 飛將
        let ty = py + (piece.color === 'red' ? -1 : 1);
        while (ty >= 0 && ty <= 9) {
            const t = game.board[px][ty];
            if (t) {
                if (t.type === 'G') moves.push({x: px, y: ty}); // 可以吃對方將
                break;
            }
            ty += (piece.color === 'red' ? -1 : 1);
        }
    }
    else if (piece.type === 'A' && game.boardType === 'full') {
        [[1,1], [1,-1], [-1,1], [-1,-1]].forEach(d => addIfValid(px+d[0], py+d[1]));
    }
    else if (piece.type === 'E' && game.boardType === 'full') {
        [[2,2], [2,-2], [-2,2], [-2,-2]].forEach(d => {
            const ex = px + d[0]/2, ey = py + d[1]/2;
            if (!game.board[ex][ey]) addIfValid(px+d[0], py+d[1]); // 象眼無阻
        });
    }
    else if (piece.type === 'H') {
        [[1,2], [1,-2], [-1,2], [-1,-2], [2,1], [2,-1], [-2,1], [-2,-1]].forEach(d => {
            // 拐馬腳
            const bx = px + (Math.abs(d[0]) === 2 ? d[0]/2 : 0);
            const by = py + (Math.abs(d[1]) === 2 ? d[1]/2 : 0);
            if (bx>=0 && bx<=8 && by>=0 && by<=(game.boardType==='full'?9:4) && !game.board[bx][by]) {
                addIfValid(px+d[0], py+d[1]);
            }
        });
    }
    else if (piece.type === 'R' || piece.type === 'C') {
        [[0,1], [0,-1], [1,0], [-1,0]].forEach(d => {
            let tx = px + d[0], ty = py + d[1], jumped = false;
            while (tx >= 0 && tx <= 8 && ty >= 0 && ty <= (game.boardType==='full'?9:4)) {
                const target = game.board[tx][ty];
                if (!target) {
                    if (!jumped && piece.type !== 'C' || !jumped && piece.type === 'C') addIfValid(tx, ty);
                } else {
                    if (piece.type === 'R') { addIfValid(tx, ty); break; }
                    if (piece.type === 'C') {
                        if (!jumped) jumped = true;
                        else { addIfValid(tx, ty); break; }
                    }
                }
                tx += d[0]; ty += d[1];
            }
        });
    }
    else if (piece.type === 'S' && game.boardType === 'full') {
        const dir = piece.color === 'red' ? -1 : 1;
        addIfValid(px, py + dir);
        const passedRiver = piece.color === 'red' ? py <= 4 : py >= 5;
        if (passedRiver) { addIfValid(px-1, py); addIfValid(px+1, py); }
    }

    return moves;
}

function executeMove(piece, tx, ty) {
    const validMoves = getValidMoves(piece);
    if (!validMoves.some(m => m.x === tx && m.y === ty)) {
        game.selectedPiece = null;
        renderBoard();
        return; // 不合法移動
    }

    const target = game.board[tx][ty];
    let turnContinues = false; // 用於連吃

    // 處理暗吃 (小盤且目標未翻開)
    if (target && !target.revealed && game.boardType === 'half') {
        target.revealed = true;
        if (!game.rules.darkCapture) {
             // 若未開暗吃，點擊未翻開棋子僅視為翻牌 (不可移動過去)，此處不應觸發，但防呆
             return; 
        }

        if (target.color === piece.color) {
            // 吃到自己：退回原位，回合結束
            game.selectedPiece = null;
            switchTurn();
            return;
        } else {
            // 比較大小
            let atkRank = PIECE_TYPES[piece.type].rank;
            let defRank = PIECE_TYPES[target.type].rank;
            let win = atkRank >= defRank;
            if (atkRank === 1 && defRank === 7) win = true; // 兵吃將
            if (atkRank === 7 && defRank === 1) win = false;

            if (!win) {
                // 進攻失敗，自己死
                killPiece(piece);
                game.selectedPiece = null;
                switchTurn();
                return;
            }
        }
    }

    // 正常移動或吃子
    if (target) killPiece(target);

    game.board[piece.x][piece.y] = null;
    piece.x = tx; piece.y = ty;
    game.board[tx][ty] = piece;

    // 檢查連吃
    if (target && game.boardType === 'half' && game.rules.chainCapture) {
        game.chainPieceId = piece.id;
        turnContinues = true;
        // 若該棋無路可走，強制結束
        if (getValidMoves(piece).length === 0) turnContinues = false;
    }

    if (!turnContinues) {
        game.chainPieceId = null;
        game.selectedPiece = null;
        
        // 將軍檢查 (全盤)
        if (game.boardType === 'full' && isCheck(game.turn === 'red' ? 'black' : 'red')) {
            game.canClaimWin = true;
            // CPU自動將軍獲勝
            if (game.mode === 'pvc' && game.turn === 'black') {
                setTimeout(claimWin, 1000);
            }
        } else {
            game.canClaimWin = false;
        }
        
        checkWinCondition();
        if(!game.isGameOver) switchTurn();
    } else {
        game.selectedPiece = piece; // 保持選中
        renderBoard();
        updateUI();
        saveGame();
    }
}

function killPiece(p) {
    game.pieces = game.pieces.filter(x => x.id !== p.id);
    game.board[p.x][p.y] = null;
}

function switchTurn() {
    game.turn = game.turn === 'red' ? 'black' : 'red';
    game.selectedPiece = null;
    game.chainPieceId = null;
    saveGame();
    renderBoard();
    updateUI();
    checkAutoMove();
}

function isCheck(color) {
    const king = game.pieces.find(p => p.type === 'G' && p.color === color);
    if (!king) return true; // 將被吃也算 (半盤保護)
    const enemyColor = color === 'red' ? 'black' : 'red';
    const enemies = game.pieces.filter(p => p.color === enemyColor && p.revealed);
    for (let e of enemies) {
        const moves = getValidMoves(e);
        if (moves.some(m => m.x === king.x && m.y === king.y)) return true;
    }
    return false;
}

function getDangerZone(color) {
    let dangerMoves = [];
    const enemyColor = color === 'red' ? 'black' : 'red';
    const enemies = game.pieces.filter(p => p.color === enemyColor && p.revealed);
    for (let e of enemies) {
        dangerMoves = dangerMoves.concat(getValidMoves(e));
    }
    return dangerMoves;
}

// 手動將軍按鈕
UI.btnClaimWin.onclick = claimWin;
function claimWin() {
    if (game.canClaimWin) {
        endGame(game.turn); // 當前回合方獲勝
    }
}

function checkWinCondition() {
    // 半盤判定：吃掉對方帥/將
    if (game.boardType === 'half') {
        const redG = game.pieces.find(p => p.type === 'G' && p.color === 'red');
        const blackG = game.pieces.find(p => p.type === 'G' && p.color === 'black');
        if (!redG) endGame('black');
        else if (!blackG) endGame('red');
    }
    // 全盤主要靠 claimWin，但若國王確實被吃掉也直接結束
    else {
        const redG = game.pieces.find(p => p.type === 'G' && p.color === 'red');
        const blackG = game.pieces.find(p => p.type === 'G' && p.color === 'black');
        if (!redG) endGame('black');
        else if (!blackG) endGame('red');
    }
}

function endGame(winnerColor) {
    game.isGameOver = true;
    localStorage.removeItem('xiangqi_save'); // 清除存檔
    UI.winMessage.innerText = winnerColor === 'red' ? '紅方獲勝！' : '黑方獲勝！';
    UI.winMessage.style.color = winnerColor === 'red' ? '#d32f2f' : '#1976d2';
    setTimeout(() => {
        UI.gameOverModal.classList.remove('hidden');
    }, 500);
}

// --- AI 邏輯 ---
function checkAutoMove() {
    if (game.mode === 'pvc' && game.turn === 'black' && !game.isGameOver) {
        setTimeout(makeAIMove, 500); // 稍微延遲讓玩家看清楚
    }
}

function makeAIMove() {
    // 取得所有合法行動 (包含翻牌與移動)
    let actions = [];
    
    // 如果在連吃狀態，只能移動那顆棋
    let myPieces = game.pieces.filter(p => p.color === 'black' && p.revealed);
    if (game.chainPieceId) {
        myPieces = myPieces.filter(p => p.id === game.chainPieceId);
    }

    myPieces.forEach(p => {
        const moves = getValidMoves(p);
        moves.forEach(m => actions.push({type: 'move', piece: p, tx: m.x, ty: m.y}));
    });

    // 翻牌行動 (僅限非連吃狀態)
    if (!game.chainPieceId && game.boardType === 'half') {
        const hiddens = game.pieces.filter(p => !p.revealed);
        hiddens.forEach(p => actions.push({type: 'flip', piece: p}));
    }

    if (actions.length === 0) {
        if(game.chainPieceId) {
             // 連吃卡死，結束回合
             game.chainPieceId = null;
             switchTurn();
        } else {
             endGame('red'); // 無路可走，認輸
        }
        return;
    }

    // 根據難度決定搜尋深度與隨機性
    let chosenAction = actions[0];
    
    if (game.cpuLevel === 1) {
        // 隨機
        chosenAction = actions[Math.floor(Math.random() * actions.length)];
    } else {
        // 簡易評估 (尋找吃子或高價值翻牌)
        let bestScore = -Infinity;
        let bestActions = [];
        
        actions.forEach(a => {
            let score = 0;
            if (a.type === 'move') {
                const target = game.board[a.tx][a.ty];
                if (target) {
                    if (target.revealed) {
                        score += PIECE_TYPES[target.type].rank * 10;
                    } else if (game.rules.darkCapture) {
                        // 暗吃風險評估：簡單期望值
                        const myRank = PIECE_TYPES[a.piece.type].rank;
                        score += (myRank >= 4) ? 5 : -5; // 大棋才敢盲吃
                    }
                }
                // CPU 難度加成：更傾向於進攻
                if (game.cpuLevel >= 3) score += Math.random() * 2;
                if (game.cpuLevel >= 4 && game.boardType === 'full') {
                    // 向將軍推進
                    score += a.ty > 4 ? 2 : 0; 
                }
            } else if (a.type === 'flip') {
                score += 1; // 基本翻牌分
            }

            // 加一點隨機性避免死板 (等級越高越低)
            score += Math.random() * (5 - game.cpuLevel);

            if (score > bestScore) {
                bestScore = score;
                bestActions = [a];
            } else if (score === bestScore) {
                bestActions.push(a);
            }
        });
        chosenAction = bestActions[Math.floor(Math.random() * bestActions.length)];
    }

    // 執行 AI 行動
    if (chosenAction.type === 'flip') {
        chosenAction.piece.revealed = true;
        switchTurn();
    } else {
        executeMove(chosenAction.piece, chosenAction.tx, chosenAction.ty);
    }
}

// --- 存檔系統 (LocalStorage) ---
function saveGame() {
    if (game.isGameOver) return;
    const saveState = {
        mode: game.mode,
        boardType: game.boardType,
        cpuLevel: game.cpuLevel,
        turn: game.turn,
        rules: game.rules,
        chainPieceId: game.chainPieceId,
        pieces: game.pieces.map(p => ({...p})) // Deep copy pieces
    };
    localStorage.setItem('xiangqi_save', JSON.stringify(saveState));
}

function loadGame() {
    try {
        const saveState = JSON.parse(localStorage.getItem('xiangqi_save'));
        game.mode = saveState.mode;
        game.boardType = saveState.boardType;
        game.cpuLevel = saveState.cpuLevel;
        game.turn = saveState.turn;
        game.rules = saveState.rules;
        game.chainPieceId = saveState.chainPieceId;
        game.pieces = saveState.pieces;
        game.isGameOver = false;

        // 同步 UI 狀態
        document.getElementById('in-chk-hints').checked = game.rules.hints;
        document.getElementById('in-chk-danger').checked = game.rules.dangerZone;
        document.getElementById('in-chk-dark').checked = game.rules.darkCapture;
        document.getElementById('in-chk-chain').checked = game.rules.chainCapture;
        document.getElementById('in-half-rules').classList.toggle('hidden', game.boardType === 'full');

        // 重建 Board Array
        const cols = 9;
        const rows = game.boardType === 'full' ? 10 : 5;
        game.board = Array(cols).fill(null).map(() => Array(rows).fill(null));
        game.pieces.forEach(p => { game.board[p.x][p.y] = p; });

    } catch(e) {
        console.error("存檔讀取失敗", e);
        localStorage.removeItem('xiangqi_save');
        UI.menu.classList.remove('hidden');
    }
}
