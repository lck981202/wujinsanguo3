// Global State
let currentDay = 1;
let gameTimer = null;

let gameState = { currentScenario: null, selectedLord: null, year: 184, month: 1, ap: 5, maxAp: 5, citiesData: [], playerGold: 2000, morale: 70, stability: 70 };

// 士气效果表
function getMoraleBonus(morale) {
    if(morale >= 90) return { label: '🔥 同仇敌忾', atkMod: 1.15, defMod: 1.10, desc: '全军士气如虹！' };
    if(morale >= 75) return { label: '⚔️ 士气高昂', atkMod: 1.08, defMod: 1.05, desc: '战意旺盛' };
    if(morale >= 55) return { label: '😐 士气平稳', atkMod: 1.0, defMod: 1.0, desc: '军心稳定' };
    if(morale >= 35) return { label: '😰 士气低落', atkMod: 0.90, defMod: 0.95, desc: '军心不稳' };
    return { label: '💀 士气崩溃', atkMod: 0.75, defMod: 0.80, desc: '随时可能溃散！' };
}
const FACTION_COLORS = ['#F4E04D', '#7C3AED', '#4CAF50', '#C41E3A', '#4682B4', '#FF9800', '#009688', '#9C27B0', '#E91E63', '#FF5722'];
let activeCityId = null;
let pendingAttackState = { attackerId: null, targetId: null };

document.addEventListener('DOMContentLoaded', () => { addLog("系统初始化完成，请选择时代。", "good"); });

function showMainMenu() { hideAllMenus(); document.getElementById('menu-main').classList.remove('hidden'); document.getElementById('hud-layer').style.display = 'none'; document.getElementById('game-title').style.display = 'none'; closeCityPopup(); }
function showScenarioSelect() { hideAllMenus(); document.getElementById('menu-scenario').classList.remove('hidden'); renderScenarios(); }
function showLordSelect(id) {
    gameState.currentScenario = SCENARIOS.find(s => s.id === id);
    if(!gameState.currentScenario) {
        console.error("找不到剧本 ID:", id);
        return;
    }
    hideAllMenus(); document.getElementById('menu-lord').classList.remove('hidden');
    document.getElementById('lord-title').innerText = '选择主公 - ' + gameState.currentScenario.title;
    gameState.selectedLord = null; document.getElementById('btn-enter-game').classList.remove('visible');
    renderLords(id);
}
function hideAllMenus() { ['menu-main','menu-scenario','menu-lord'].forEach(id=>document.getElementById(id).classList.add('hidden')); closeAttackPopup(); closeCityPopup(); closeDipPopup(); }
function selectLord(id) {
    const lords = SCENARIO_LORDS[gameState.currentScenario.id]; const lord = lords.find(l => l.id === id); if(!lord) return;
    gameState.selectedLord = lord;
    document.querySelectorAll('.lord-card').forEach(el => el.classList.remove('selected'));
    document.getElementById('lord-card-'+id).classList.add('selected');
    document.getElementById('btn-enter-game').classList.add('visible');
}
function enterGame() {
    // 1. 检查基本数据
    if(!gameState.currentScenario) {
        alert("错误：未选择剧本！");
        return;
    }
    if(!gameState.selectedLord) {
        alert("请选择一位主公！");
        return;
    }
    
    // 2. 初始化状态
    gameState.year = gameState.currentScenario.year; 
    gameState.month = 1;
    gameState.day = 1;
    gameState.maxAp = getMaxAP();
    gameState.ap = gameState.maxAp;
    gameState.playerGold = 2000;
    
    // 3. 设置剧本标识
    const is220 = (gameState.currentScenario.id === 220);
    const is208 = (gameState.currentScenario.id === 208);
    const is215 = (gameState.currentScenario.id === 215);
    const is263 = (gameState.currentScenario.id === 263);
    const is200 = (gameState.currentScenario.id === 200);
    const is195 = (gameState.currentScenario.id === 195);
    const is190 = (gameState.currentScenario.id === 190);
    const is249 = (gameState.currentScenario.id === 249);
    const is184 = (gameState.currentScenario.id === 184);

    // 4. 初始化外交关系
    gameState.relations = {};
    const allLords = SCENARIO_LORDS[gameState.currentScenario.id];
    if(!allLords) {
        alert("错误：找不到剧本势力数据！");
        return;
    }

    allLords.forEach(l => {
        if(l.id !== gameState.selectedLord.id) gameState.relations[l.id] = 50;
    });
    
    // AI 关系初始化
    allLords.forEach(l => {
        allLords.forEach(l2 => {
            if(l.id !== l2.id && l.id !== gameState.selectedLord.id) {
                gameState.relations[l.id + '_to_' + l2.id] = 40 + Math.floor(Math.random() * 25);
            }
        });
    });

    // 5. 特殊剧本关系 (此处省略部分，保持简洁，主要修复语法)
    // ... (Keeping the logic simple for now to ensure it loads)
    // We can rely on the generic 50 relation for now if specific logic fails, 
    // but let's keep it working.
    
    // 6. 士气/稳定度初始化 (Basic)
    if(is220) {
        if(gameState.selectedLord.id === 'liu_bei') { gameState.morale = 95; gameState.stability = 75; }
        else if(gameState.selectedLord.id === 'cao_pi') { gameState.morale = 65; gameState.stability = 80; }
        else if(gameState.selectedLord.id === 'sun_quan') { gameState.morale = 45; gameState.stability = 55; }
        else { gameState.morale = 70; gameState.stability = 60; }
    } else {
        gameState.morale = 70; gameState.stability = 70;
    }

    // 7. UI 切换
    hideAllMenus(); 
    document.getElementById('hud-layer').style.display = 'block'; 
    document.getElementById('game-title').style.display = 'block';
    
    // 8. 启动游戏
    updateHUD(); 
    initGameMap(); 
    updateMyFactionPanel();
    updateMoralePanel();
    updateStabilityPanel();
    
    // 9. 日志
    addLog(`🔥 ${gameState.currentScenario.title} 开启！您选择了 ${gameState.selectedLord.name}！`, "good");
}

function initGameMap() {
    console.log("Map Init Started");
    const layer = document.getElementById('city-layer'); layer.innerHTML = '';
    if(!gameState.citiesData || gameState.citiesData.length === 0) {
        if(typeof CITIES_CONFIG === 'undefined') { console.error("CITIES_CONFIG Missing!"); return; }
        gameState.citiesData = JSON.parse(JSON.stringify(CITIES_CONFIG));
        const lords = SCENARIO_LORDS[gameState.currentScenario.id];
        gameState.citiesData.forEach(city => {
            city.currentTroops = Math.floor(city.base_pop * 0.05); city.currentDefense = city.base_def; city.currentGrain = Math.floor(city.base_pop * 0.2);
            // 根据剧本中各主公的城池分配
            let assigned = false;
            for (const lord of lords) {
                if (lord.cities && lord.cities.includes(city.id)) {
                    city.owner = lord.id; city.ownerName = lord.name; city.ownerColor = lord.color;
                    assigned = true; break;
                }
            }
            if (!assigned) {
                const lord = lords[Math.floor(Math.random()*lords.length)];
                city.owner = lord.id; city.ownerName = lord.name; city.ownerColor = lord.color;
            }
        });
    }
    gameState.citiesData.forEach(city => {
        const point = document.createElement('div'); point.className = 'city-point';
        point.style.left = city.x + 'px'; point.style.top = city.y + 'px';
        point.style.background = city.ownerColor; point.style.borderColor = (city.owner===gameState.selectedLord.id)?'#ffd700':'rgba(0,0,0,0.5)';
        
        const label = document.createElement('div'); label.className = 'city-name-label'; label.innerText = city.name; point.appendChild(label);
        point.onclick = (e) => { e.stopPropagation(); showCityPopup(city); };
        layer.appendChild(point);
    });
    updateStabilityPanel(); updateMyFactionPanel();
}


// === 城池防御上限计算 ===
function getDefenseCap(cityId) {
    const tier1 = ['tongguan', 'wuguan', 'hulao', 'jianmen', 'yanmenguan', 'shangyong', 'jieting', 'baidi']; // 关隘/险地 20000
    const tier2 = ['luoyang', 'chang_an', 'chengdu', 'jianye', 'ye', 'xiangyang', 'shouchun', 'xuzhou', 'wancheng', 'jizhou_cheng', 'nanyang', 'changsha']; // 王都/重镇 15000
    if(tier1.includes(cityId)) return 20000;
    if(tier2.includes(cityId)) return 15000;
    return 10000; // 默认郡县 10000
}


function doRepair(cityId) {
    const city = gameState.citiesData.find(c => c.id === cityId);
    const maxDef = getDefenseCap(cityId);
    const cost = 100;
    
    if(gameState.playerGold < cost) {
        addLog("⚠️ 黄金不足，无法修缮！", "bad");
        return;
    }
    if(city.currentDefense >= maxDef) {
        addLog("ℹ️ 该城防已修缮至极限，无需修缮。", "neutral");
        return;
    }

    gameState.playerGold -= cost;
    const increase = Math.min(500, maxDef - city.currentDefense);
    city.currentDefense += increase;
    
    addLog(`🔨 ${city.name} 城防修缮完成！防御 +${increase} (当前 ${city.currentDefense}/${maxDef})`, "good");
    showCityPopup(city); // Refresh popup
    updateHUD();
    updateMyFactionPanel();
}

function showCityPopup(city) {
    activeCityId = city.id;
    closeAttackPopup();
    const popup = document.getElementById('city-popup');
    document.getElementById('cp-city-name').innerText = city.name;
    document.getElementById('cp-faction').innerText = city.ownerName;
    document.getElementById('cp-faction').style.color = city.ownerColor;
    const maxDef = getDefenseCap(city.id);
    document.getElementById('cp-defense').innerHTML = `${city.currentDefense} <span style="color:#666">/ ${maxDef}</span>`;
    document.getElementById('cp-pop').innerText = city.base_pop.toLocaleString();
    document.getElementById('cp-troops').innerText = city.currentTroops.toLocaleString();
    document.getElementById('cp-grain').innerText = city.currentGrain.toLocaleString();
    document.getElementById('cp-gold').innerText = gameState.playerGold.toLocaleString();
    
    // 显示该城粮草消耗
    const grainCost = Math.floor(city.currentTroops / 100);
    document.getElementById('cp-grain-cost').innerText = grainCost.toLocaleString();

    // Position: to the right of the city
    let left = city.x + 24;
    let top = city.y - 30;
    if (left + 290 > 1280) left = city.x - 290;
    if (top < 10) top = 10;
    if (top + 300 > 900) top = 900 - 310;
    popup.style.left = left + 'px';
    popup.style.top = top + 'px';

    const actions = document.getElementById('cp-actions'); actions.innerHTML = '';
    const isMine = (city.owner === gameState.selectedLord.id);
    if(isMine) {
        // 修缮按钮
        const repairCost = 100;
        const maxDef = getDefenseCap(city.id);
        const canRepair = gameState.playerGold >= repairCost && city.currentDefense < maxDef;
        const btnRepair = document.createElement('button');
        btnRepair.className = 'btn-action' + (canRepair ? '' : ' btn-disabled');
        btnRepair.style.background = '#0f766e'; // Teal color
        btnRepair.innerHTML = `<span>🔨 修缮城防 (+${Math.min(500, maxDef - city.currentDefense)})</span> <span>💰${repairCost}</span>`;
        if(canRepair) btnRepair.onclick = () => doRepair(city.id);
        actions.appendChild(btnRepair);
        // 征兵按钮（受稳定度影响）
        const btnR = document.createElement('button'); btnR.className = 'btn-action btn-recruit';
        let recruitCost = 500;
        if(gameState.stability < 30) recruitCost = Math.round(recruitCost * 1.3);
        else if(gameState.stability >= 85) recruitCost = Math.round(recruitCost * 0.9);
        const lowG = (gameState.playerGold < recruitCost);
        btnR.innerHTML = `<span>🛡️ 征兵 (+1000)</span> <span>💰${recruitCost} 👥-5000</span>`;
        const lowAP_R = (gameState.ap < 1); // Check AP
        if(lowG || lowAP_R) btnR.classList.add('btn-disabled'); 
        btnR.onclick = () => { if(!lowG && !lowAP_R) doRecruit(recruitCost, 1000); }; 
        actions.appendChild(btnR);
        
        // 买粮按钮
        const btnGr = document.createElement('button'); btnGr.className = 'btn-action btn-buy';
        const grainCost = 100;
        const lowGr = (gameState.playerGold < grainCost);
        const lowAP_G = (gameState.ap < 1); // Check AP
        btnGr.innerHTML = `<span>🌾 买粮 (+1000)</span> <span>💰${grainCost}</span>`;
        if(lowGr || lowAP_G) btnGr.classList.add('btn-disabled'); 
        btnGr.onclick = () => { if(!lowGr && !lowAP_G) doBuyGrain(grainCost, 1000); }; 
        actions.appendChild(btnGr);
        
        // 调兵按钮
        const otherCities = gameState.citiesData.filter(c => c.owner === gameState.selectedLord.id && c.id !== city.id && c.currentTroops > 100);
        if(otherCities.length > 0 && gameState.ap >= 1) {
            const btnT = document.createElement('button'); btnT.className = 'btn-action';
            btnT.style.background = '#1a5276';
            btnT.innerHTML = `<span>🚚 调兵</span> <span>⚡1点</span>`;
            btnT.onclick = () => openTransferPopup(city.id); actions.appendChild(btnT);
        }
    } else {
        const adj = getAdjacentPlayerCities(city.id);
        if(adj.length > 0 && gameState.ap >= 2) {
            const btn = document.createElement('button'); btn.className = 'btn-action btn-attack';
            btn.innerHTML = `<span>⚔️ 攻城</span> <span>⚡2点</span>`; btn.onclick = () => openAttackPopup(city.id); actions.appendChild(btn);
        } else { actions.innerHTML = '<div style="color:#888; text-align:center; font-size:12px; padding:6px;">距离太远或行动力不足</div>'; }
    }
    popup.classList.add('show');
}
function closeCityPopup() { document.getElementById('city-popup').classList.remove('show'); }

// === Economy ===
function doRecruit(goldCost, troops) {
    const city = gameState.citiesData.find(x => x.id === activeCityId); if(!city) return;
    if(gameState.playerGold < goldCost) { addLog("⚠️ 黄金不足！", "bad"); return; }
    
    // 征兵消耗人口（每1000兵消耗5000人口）
    const popCost = Math.floor(troops * 5);
    city.base_pop = Math.max(0, city.base_pop - popCost);
    
    gameState.playerGold -= goldCost;
    city.currentTroops += troops;
    gameState.ap = Math.max(0, gameState.ap - 1);
    updateHUD(); updateMyFactionPanel(); showCityPopup(city);
    addLog(`🛡️ 在 ${city.name} 征兵 ${troops.toLocaleString()}！消耗黄金 ${goldCost}，人口 -${popCost.toLocaleString()}`, "good");
}

function doBuyGrain(cost, grain) {
    const city = gameState.citiesData.find(x => x.id === activeCityId); if(!city) return;
    if(gameState.playerGold < cost) { addLog("⚠️ 黄金不足！", "bad"); return; }
    
    gameState.playerGold -= cost;
    city.currentGrain += grain;
    gameState.ap = Math.max(0, gameState.ap - 1);
    updateHUD(); updateMyFactionPanel(); showCityPopup(city);
    addLog(`🌾 在 ${city.name} 购入粮草 ${grain.toLocaleString()}！消耗黄金 ${cost}`, "good");
}

// === 调兵系统 ===
function openTransferPopup(targetCityId) {
    activeCityId = targetCityId;
    closeCityPopup();
    const target = gameState.citiesData.find(c => c.id === targetCityId);
    const myCities = gameState.citiesData.filter(c => c.owner === gameState.selectedLord.id && c.id !== targetCityId && c.currentTroops > 100);
    
    const popup = document.getElementById('attack-popup');
    document.getElementById('popup-title').innerText = `🚚 调兵至 ${target.name}`;
    
    let left = target.x + 30;
    let top = target.y - 20;
    if (left + 250 > 1280) left = target.x - 260;
    if (top < 10) top = 10;
    if (top + 300 > 900) top = 900 - 310;
    popup.style.left = left + 'px';
    popup.style.top = top + 'px';
    
    const list = document.getElementById('attack-source-list'); list.innerHTML = '';
    
    // 按距离排序
    myCities.sort((a, b) => {
        const da = Math.sqrt(Math.pow(a.x - target.x, 2) + Math.pow(a.y - target.y, 2));
        const db = Math.sqrt(Math.pow(b.x - target.x, 2) + Math.pow(b.y - target.y, 2));
        return da - db;
    });
    
    if (myCities.length === 0) {
        list.innerHTML = '<div style="color:#888; text-align:center; font-size:12px; padding:10px;">没有可调兵的城池</div>';
    } else {
        myCities.forEach(c => {
            const dist = Math.sqrt(Math.pow(c.x - target.x, 2) + Math.pow(c.y - target.y, 2));
            const goldCost = Math.round(dist * 0.5);
            const grainCost = Math.round(dist * 0.8);
            const transferable = Math.max(100, Math.floor(c.currentTroops * 0.8));
            
            const btn = document.createElement('button'); btn.className = 'popup-btn';
            btn.innerHTML = `<span class="btn-city">🚩 ${c.name}</span> <span class="btn-troops">兵:${c.currentTroops} 💰${goldCost} 🌾${grainCost}</span>`;
            btn.title = `可调 ${transferable} 兵`;
            btn.onclick = () => doTransfer(c.id, targetCityId, transferable); 
            list.appendChild(btn);
        });
    }
    popup.classList.add('show');
}

function doTransfer(fromId, toId, amount) {
    const from = gameState.citiesData.find(c => c.id === fromId);
    const to = gameState.citiesData.find(c => c.id === toId);
    if(!from || !to) return;
    
    const dist = Math.sqrt(Math.pow(from.x - to.x, 2) + Math.pow(from.y - to.y, 2));
    const goldCost = Math.round(dist * 0.5);
    const grainCost = Math.round(dist * 0.8);
    
    if(gameState.playerGold < goldCost) { addLog(`⚠️ 黄金不足！需要 ${goldCost}`, "bad"); return; }
    if(from.currentGrain < grainCost) { addLog(`⚠️ 粮草不足！需要 ${grainCost}`, "bad"); return; }
    if(gameState.ap < 1) { addLog("⚠️ 行动力不足！", "bad"); return; }
    
    const actualAmount = Math.min(amount, from.currentTroops);
    from.currentTroops -= actualAmount;
    from.currentGrain -= grainCost;
    gameState.playerGold -= goldCost;
    to.currentTroops += actualAmount;
    gameState.ap = Math.max(0, gameState.ap - 1);
    
    addLog(`🚚 从 ${from.name} 调兵 ${actualAmount.toLocaleString()} 至 ${to.name}！距离 ${Math.round(dist)}，消耗黄金 ${goldCost}、粮草 ${grainCost}`, "good");
    
    closeAttackPopup();
    updateHUD(); updateMyFactionPanel();
    showCityPopup(to);
}

// === War System (Enriched) ===
function getAdjacentPlayerCities(targetId) {
    const target = gameState.citiesData.find(c => c.id === targetId);
    return gameState.citiesData.filter(c => { if(c.owner !== gameState.selectedLord.id) return false; return Math.sqrt(Math.pow(c.x-target.x,2)+Math.pow(c.y-target.y,2)) < 110; });
}
function openAttackPopup(targetId) {
    activeCityId = targetId;
    const target = gameState.citiesData.find(c => c.id === targetId);
    const popup = document.getElementById('attack-popup');
    document.getElementById('popup-title').innerText = '⚔️ 攻占 ' + target.name;
    
    // Position: to the right of the target city
    let left = target.x + 30;
    let top = target.y - 20;
    // Keep within stage bounds
    if (left + 250 > 1280) left = target.x - 260; // flip to left if near edge
    if (top < 10) top = 10;
    if (top + 250 > 900) top = 900 - 260;
    
    popup.style.left = left + 'px';
    popup.style.top = top + 'px';
    
    const list = document.getElementById('attack-source-list'); list.innerHTML = '';
    const sources = getAdjacentPlayerCities(targetId);
    if (sources.length === 0) {
        list.innerHTML = '<div style="color:#888; text-align:center; font-size:12px; padding:10px;">没有可出兵的城池</div>';
    } else {
        sources.forEach(c => {
            const btn = document.createElement('button'); btn.className = 'popup-btn';
            btn.innerHTML = `<span class="btn-city">🚩 ${c.name}</span> <span class="btn-troops">兵: ${c.currentTroops}</span>`;
            btn.onclick = () => selectAttacker(c.id, targetId); list.appendChild(btn);
        });
    }
    popup.classList.add('show');
}
function closeAttackPopup() { document.getElementById('attack-popup').classList.remove('show'); }


// === 攻城流程控制 ===
function selectAttacker(attackerId, targetId) {
    pendingAttackState.attackerId = attackerId;
    pendingAttackState.targetId = targetId;
    
    const attackerCity = gameState.citiesData.find(c => c.id === attackerId);
    const targetCity = gameState.citiesData.find(c => c.id === targetId);
    
    if(!attackerCity || !targetCity) return;
    
    // 隐藏列表，显示选择面板
    document.getElementById('attack-source-list').style.display = 'none';
    const panel = document.getElementById('troop-select-panel');
    panel.style.display = 'block';
    
    // 设置 UI
    document.getElementById('sel-city-name').innerText = attackerCity.name;
    document.getElementById('sel-city-max').innerText = attackerCity.currentTroops;
    
    const slider = document.getElementById('troop-slider');
    slider.max = attackerCity.currentTroops;
    slider.value = attackerCity.currentTroops; // 默认全选
    
    updateTroopDisplay();
}

function updateTroopDisplay() {
    const slider = document.getElementById('troop-slider');
    const val = parseInt(slider.value);
    document.getElementById('troop-val-display').innerText = val;
    
    // 检查围城条件: 5倍兵力
    const targetCity = gameState.citiesData.find(c => c.id === pendingAttackState.targetId);
    if(targetCity && val >= targetCity.currentTroops * 5) {
        document.getElementById('btn-siege').style.display = 'block';
    } else {
        document.getElementById('btn-siege').style.display = 'none';
    }
}

function backToCityList() {
    document.getElementById('troop-select-panel').style.display = 'none';
    document.getElementById('attack-source-list').style.display = 'block';
}

function executeAttack(type) {
    const attackerId = pendingAttackState.attackerId;
    const targetId = pendingAttackState.targetId;
    const troops = parseInt(document.getElementById('troop-slider').value);
    
    if(type === 'siege') {
        doSiege(attackerId, targetId, troops);
    } else {
        resolveBattle(attackerId, targetId, troops);
    }
}

function doSiege(attId, defId, committedTroops) {
    const att = gameState.citiesData.find(c => c.id === attId);
    const def = gameState.citiesData.find(c => c.id === defId);
    if(!att || !def) return;
    
    // 检查 5 倍兵力
    if(committedTroops < def.currentTroops * 5) {
        addLog("⚠️ 兵力不足 5 倍，无法发动围城断粮！", "bad");
        return;
    }
    
    // 消耗 AP
    if(gameState.ap < 1) {
        addLog("⚠️ 行动力不足，无法围城！", "bad");
        return;
    }
    gameState.ap -= 1;
    
    // 扣粮逻辑
    // 围城导致敌军粮草急剧消耗
    const grainDrain = Math.floor(def.currentTroops * 2 + 500);
    def.currentGrain = Math.max(0, def.currentGrain - grainDrain);
    
    addLog(`🏰 【天下大势】${gameState.selectedLord.name} 大军围困 ${def.name}！敌军粮草消耗 ${grainDrain}！`, "neutral");
    
    // 判定粮尽
    if(def.currentGrain <= 0) {
        // 敌军投降/破城
        addLog(`💀 【天下大势】${def.name} 粮草耗尽，守军哗变！城池陷落！`, "good");
        
        // 占领逻辑
        def.owner = att.owner; 
        def.ownerName = att.ownerName; 
        def.ownerColor = att.ownerColor;
        
        // 攻方微损 (1%)
        const loss = Math.floor(committedTroops * 0.01);
        att.currentTroops -= loss;
        
        // 俘虏 (30%)
        const capture = Math.floor(def.currentTroops * 0.3);
        att.currentTroops += capture;
        def.currentTroops = Math.floor(def.currentTroops * 0.5); // 剩余一半残兵
        
        initGameMap();
    } else {
        addLog(`🌾 ${def.name} 剩余粮草: ${def.currentGrain}`, "neutral");
    }
    
    updateHUD();
    updateMyFactionPanel();
    closeAttackPopup();
}

function resolveBattle(attId, defId, committedTroops) {
    // 1. 检查行动力
    if(gameState.ap < 2) { 
        addLog("⚠️ 行动力不足，无法发动攻击！", "bad"); 
        closeAttackPopup(); 
        return; 
    }

    // === 核心修复：立刻扣除行动力 ===
    gameState.ap = Math.max(0, gameState.ap - 2);
    console.log("⚔️ 战斗开始，AP已扣除，剩余: " + gameState.ap);
    
    closeAttackPopup(); 
    closeCityPopup();
    
    // 2. 基础参数
    const tactic = document.getElementById('tactic-select') ? document.getElementById('tactic-select').value : 'normal';
    const att = gameState.citiesData.find(c => c.id === attId); 
    const def = gameState.citiesData.find(c => c.id === defId);
    if(!att || !def) return;

    let atkMod = 1.0; let defMod = 1.0; let logMsg = "";
    if(tactic === 'assault') { atkMod = 1.3; defMod = 0.8; logMsg = "🔥 [强攻] "; }
    else if(tactic === 'raid') {
        if(Math.random() > 0.5) { atkMod = 1.8; defMod = 0.6; logMsg = "🌙 [夜袭成功] "; }
        else { atkMod = 0.5; defMod = 1.2; logMsg = "🌙 [夜袭失败] "; }
    } else { logMsg = "⚔️ [普通] "; }

    // 3. 兵力获取 (使用选定兵力)
    let attTroops = committedTroops || att.currentTroops || 0;
    // 确保不出超过现有兵力
    attTroops = Math.min(attTroops, att.currentTroops);
    const defTroops = def.currentTroops || 0;
    const defDefense = def.currentDefense || 0;

    let terrainMod = 1.0;
    if (def.type === 'pass') { terrainMod = 1.3; }
    
    // 4. 战力计算
    const attMorale = getMoraleBonus(gameState.morale);
    const defMorale = getMoraleBonus(70);
    
    const atk = attTroops * atkMod * attMorale.atkMod * (0.8 + Math.random()*0.4);
    const dfs = (defTroops + defDefense*5) * defMod * terrainMod * defMorale.defMod * (0.8 + Math.random()*0.4);
    
    const ratio = atk / Math.max(dfs, 1);
    
    // 5. 绝对碾压判定
    let resultType = 'unknown';
    let attLossPct = 0, defLossPct = 0;
    
    if(attTroops > dfs * 3) { resultType = 'crush'; }
    else if(attTroops > dfs * 1.5) { resultType = 'win'; }
    else if(ratio > 2.0) { resultType = 'crush'; }
    else if(ratio > 1.3) { resultType = 'win'; }
    else if(ratio > 0.8) { resultType = Math.random()>0.5?'win_narrow':'lose_narrow'; }
    else if(ratio > 0.5) { resultType = 'lose_narrow'; }
    else { resultType = 'crush_loss'; }
    
    // 6. 伤亡计算
    if(resultType === 'crush') { attLossPct = 0.05 + Math.random()*0.08; defLossPct = 0.50 + Math.random()*0.30; }
    else if(resultType === 'win') { attLossPct = 0.12 + Math.random()*0.13; defLossPct = 0.35 + Math.random()*0.25; }
    else if(resultType.includes('narrow')) { attLossPct = 0.20 + Math.random()*0.15; defLossPct = 0.20 + Math.random()*0.15; }
    else { attLossPct = 0.35 + Math.random()*0.20; defLossPct = 0.05 + Math.random()*0.08; }
    
    let attLoss = Math.floor(attTroops * attLossPct);
    let defLoss = Math.floor(defTroops * defLossPct);
    
    att.currentTroops = Math.max(0, attTroops - attLoss);
    def.currentTroops = Math.max(0, defTroops - defLoss);
    
    // 7. 城防损耗
    let defenseLoss = 0;
    if(resultType.includes('win') || resultType === 'crush') { defenseLoss = Math.floor(defDefense * 0.4); }
    else if(resultType.includes('narrow') || resultType === 'stalemate') { defenseLoss = Math.floor(defDefense * 0.15); }
    else { defenseLoss = Math.floor(defDefense * 0.05); }
    def.currentDefense = Math.max(0, defDefense - defenseLoss);
    
    // 8. 结果结算
    const lordName = gameState.selectedLord ? gameState.selectedLord.name : "玩家";
    const isVictory = resultType.includes('win') || resultType === 'crush';
    
    if(isVictory) {
        const captureTroops = Math.floor(def.currentTroops * 0.1);
        att.currentTroops += captureTroops;
        const lootGold = Math.floor(def.currentGold * (resultType === 'crush' ? 0.5 : 0.3));
        const lootGrain = Math.floor(def.currentGrain * (resultType === 'crush' ? 0.6 : 0.4));
        gameState.playerGold += lootGold;
        def.currentGold -= lootGold; def.currentGrain -= lootGrain;
        def.owner = att.owner; def.ownerName = att.ownerName; def.ownerColor = att.ownerColor;
        
        let moraleGain = resultType === 'crush' ? 12 : 6;
        gameState.morale = Math.min(100, gameState.morale + moraleGain);
        
        addLog(`⚔️ 【天下大势】${lordName} 攻占 ${def.name}！伤亡 ${attLoss}, 破防 ${defenseLoss} (金${lootGold}, 粮${lootGrain}) 士气+${moraleGain}`, "good");
        initGameMap();
    } else {
        let moraleLoss = resultType === 'crush_loss' ? 15 : 8;
        gameState.morale = Math.max(0, gameState.morale - moraleLoss);
        let rLabel = resultType === 'crush_loss' ? '💀 惨败' : '😤 攻城失利';
        addLog(`📉 【天下大势】${lordName} ${rLabel} ${def.name}！伤亡 ${attLoss}, 敌损 ${defLoss}, 破防 ${defenseLoss} 士气-${moraleLoss}`, "bad");
        
        if(attLossPct > 0.3 && Math.random() > 0.5) {
            const counterLoss = Math.floor(att.currentTroops * 0.1);
            att.currentTroops -= counterLoss;
            gameState.morale = Math.max(0, gameState.morale - 3);
            addLog(`🔥 【天下大势】${def.name} 守军反击！我军再损 ${counterLoss} 士气-3`, "bad");
        }
    }
    
    // 9. 强制刷新 UI
    updateHUD();
    updateMyFactionPanel();
    updateMoralePanel();
    updateStabilityPanel();
}


// === 外交新机制 ===
let selectedDipFactionId = null;

function openDipDetail(factionId) {
    console.log("👉 Opening detail for:", factionId);
    selectedDipFactionId = factionId;
    const panel = document.getElementById('dip-detail-panel');
    if(panel) {
        panel.style.display = 'block';
        updateDipDetailUI();
    } else {
        console.error("❌ dip-detail-panel not found!");
    }
}

function backToDipList() {
    document.getElementById('dip-detail-panel').style.display = 'none';
    selectedDipFactionId = null;
}

function updateDipDetailUI() {
    if(!selectedDipFactionId) return;
    
    const faction = SCENARIO_LORDS[gameState.currentScenario.id].find(l => l.id === selectedDipFactionId);
    const rel = gameState.relations[selectedDipFactionId] || 0;
    
    document.getElementById('dip-detail-name').innerText = faction ? faction.name : selectedDipFactionId;
    document.getElementById('dip-detail-rel').innerText = rel;
    
    // Determine status
    let status = "中立";
    let color = "#888";
    if(rel >= 80) { status = "🤝 盟友"; color = "#4caf50"; }
    else if(rel >= 50) { status = "😊 友好"; color = "#2196f3"; }
    else if(rel >= 20) { status = "😐 中立"; color = "#888"; }
    else { status = "😡 敌对"; color = "#f44336"; }
    
    document.getElementById('dip-detail-status').innerText = status;
    document.getElementById('dip-detail-status').style.color = color;
    
    // Update buttons state
    const ap = gameState.ap;
    const gold = gameState.playerGold;
    
    // 赠金
    document.getElementById('btn-dip-gift1').disabled = (ap < 1 || gold < 100);
    document.getElementById('btn-dip-gift2').disabled = (ap < 2 || gold < 500);
    
    // 结盟
    const canAlly = (ap >= 2 && gold >= 1000 && rel >= 80);
    document.getElementById('btn-dip-ally').disabled = !canAlly;
    if(!canAlly && rel < 80) document.getElementById('btn-dip-ally').title = "关系需达到 80";
    else if(!canAlly && gold < 1000) document.getElementById('btn-dip-ally').title = "需 1000 金";
    else if(!canAlly && ap < 2) document.getElementById('btn-dip-ally').title = "需 2 AP";
    
    // 挑衅
    document.getElementById('btn-dip-provoke').disabled = (ap < 1);
    
    document.getElementById('dip-action-msg').innerText = "";
}

function doDipGift(amount) {
    if(!selectedDipFactionId) return;
    
    const apCost = (amount >= 500) ? 2 : 1;
    if(gameState.ap < apCost || gameState.playerGold < amount) {
        alert("资源不足！");
        return;
    }
    
    gameState.ap -= apCost;
    gameState.playerGold -= amount;
    
    // Relation boost
    const boost = (amount >= 500) ? 15 : 5;
    gameState.relations[selectedDipFactionId] = Math.min(100, (gameState.relations[selectedDipFactionId]||0) + boost);
    
    addLog(`🎁 赠送${amount}金给 ${getFactionName(selectedDipFactionId)}，关系提升！`, "good");
    updateDipDetailUI();
    updateHUD();
}

function doDipAlliance() {
    if(!selectedDipFactionId) return;
    if(gameState.ap < 2 || gameState.playerGold < 1000) {
        alert("资源不足！");
        return;
    }
    
    const rel = gameState.relations[selectedDipFactionId] || 0;
    if(rel < 80) {
        alert("关系不足，对方拒绝结盟！");
        return;
    }
    
    gameState.ap -= 2;
    gameState.playerGold -= 1000;
    
    // Max out relation
    gameState.relations[selectedDipFactionId] = 100;
    
    addLog(`🤝 与 ${getFactionName(selectedDipFactionId)} 正式缔结盟约！攻守同盟！`, "good");
    updateDipDetailUI();
    updateHUD();
}

function doDipProvoke() {
    if(!selectedDipFactionId) return;
    if(gameState.ap < 1) {
        alert("行动力不足！");
        return;
    }
    
    gameState.ap -= 1;
    
    // Huge relation drop
    gameState.relations[selectedDipFactionId] = Math.max(0, (gameState.relations[selectedDipFactionId]||0) - 30);
    
    addLog(`😡 我方对 ${getFactionName(selectedDipFactionId)} 进行挑衅！关系降至冰点！`, "bad");
    updateDipDetailUI();
    updateHUD();
}


function renderDipPopup() {
    console.log("🔄 Rendering Diplomacy List...");
    const body = document.getElementById('dip-body');
    if (!body) {
        console.error("❌ dip-body element not found!");
        return;
    }
    
    body.innerHTML = ''; // Clear list
    
    const lords = SCENARIO_LORDS[gameState.currentScenario.id];
    if (!lords || lords.length === 0) {
        body.innerHTML = '<div style="text-align:center; color:#888; padding:20px;">暂无势力数据</div>';
        console.warn("⚠️ No lords found for scenario:", gameState.currentScenario.id);
        return;
    }

    const myId = gameState.selectedLord.id;

    lords.forEach(lord => {
        if (lord.id === myId) return; // Skip self

        const rel = gameState.relations[lord.id] || 0;
        
        // Create Item
        const item = document.createElement('div');
        item.style.cssText = 'background:#333; margin-bottom:8px; padding:10px; border-radius:6px; cursor:pointer; border:1px solid #444;';
        item.onmouseover = function() { this.style.borderColor='#ffd700'; };
        item.onmouseout = function() { this.style.borderColor='#444'; };
        
        // Click Handler
        item.onclick = function() {
            console.log("👆 Clicked faction:", lord.id);
            openDipDetail(lord.id);
        };

        // Status Text
        let statusText = '中立';
        let statusColor = '#888';
        if(rel >= 80) { statusText = '盟友'; statusColor = '#4caf50'; }
        else if(rel >= 50) { statusText = '友好'; statusColor = '#2196f3'; }
        else if(rel < 20) { statusText = '敌对'; statusColor = '#f44336'; }

        item.innerHTML = `
            <div style="display:flex; justify-content:space-between; align-items:center;">
                <span style="color:${lord.color}; font-weight:bold; font-size:13px;">${lord.name}</span>
                <span style="color:${statusColor}; font-size:12px;">${statusText} (${rel})</span>
            </div>
            <div style="height:4px; background:#555; margin-top:6px; border-radius:2px; overflow:hidden;">
                <div style="height:100%; width:${rel}%; background:${statusColor};"></div>
            </div>
        `;
        
        body.appendChild(item);
    });
    console.log("✅ Diplomacy List Rendered!");
}

// === Panels & Turn ===
// === AI 自动外交系统 ===
function runAIDiplomacy() {
    const lords = SCENARIO_LORDS[gameState.currentScenario.id] || [];
    const myId = gameState.selectedLord.id;
    const aiLords = lords.filter(l => l.id !== myId);
    
    aiLords.forEach(ai => {
        // AI 对其他所有势力（包括玩家和其他AI）进行外交决策
        const targets = lords.filter(l => l.id !== ai.id);
        
        targets.forEach(target => {
            // 确保双向关系存在
            if (!gameState.relations[ai.id + '_to_' + target.id]) {
                gameState.relations[ai.id + '_to_' + target.id] = 50;
            }
            
            const rel = gameState.relations[ai.id + '_to_' + target.id];
            const aiStr = getFactionStrength(ai.id);
            const targetStr = getFactionStrength(target.id);

            
            // === 1. 关系自然衰减（每月 -1~3） ===
            const decay = Math.floor(1 + Math.random() * 3);
            gameState.relations[ai.id + '_to_' + target.id] = Math.max(0, rel - decay);
            
            // === 2. AI 主动行为（有概率触发） ===
            const chance = Math.random();
            
            // AI 对玩家的特殊行为
            if (target.id === myId) {
                // 220年特殊：孙权依附曹丕
                const isVassal = (gameState.currentScenario.id === 220 && ai.id === 'sun_quan' && myId === 'cao_pi');
                if(isVassal) {
                    // 孙权定期进贡
                    if(chance < 0.3) {
                        const tribute = Math.floor(100 + Math.random() * 200);
                        gameState.relations[ai.id + '_to_' + target.id] = Math.min(100, rel + 3);
                        if(gameState.playerGold < 1000) gameState.playerGold += tribute;
                    }
                }
                // 关系很低 + AI 强于玩家 → 挑衅/宣战
                else if (rel < 20 && ratio > 1.5 && chance < 0.3) {
                    gameState.relations[ai.id + '_to_' + target.id] -= Math.floor(10 + Math.random() * 15);
                    addLog(`😡 ${ai.name} 对你恶言挑衅！`, "bad");
                }
                // 关系很高 + AI 势均力敌 → 主动请求结盟
                else if (rel >= 80 && ratio >= 0.7 && ratio <= 1.5 && chance < 0.25) {
                    gameState.relations[ai.id + '_to_' + target.id] = Math.min(100, rel + 8);
                    addLog(`🤝 ${ai.name} 向你派出使者，表达了结盟意愿！`, "good");
                }
                // 关系中等 → 偶尔遣使
                else if (rel >= 30 && rel < 70 && chance < 0.4) {
                    const gain = Math.floor(3 + Math.random() * 5);
                    gameState.relations[ai.id + '_to_' + target.id] = Math.min(100, rel + gain);
                }
                // 关系很低且AI弱于玩家 → 主动示弱
                else if (rel < 30 && ratio < 0.8 && chance < 0.35) {
                    const gain = Math.floor(5 + Math.random() * 8);
                    gameState.relations[ai.id + '_to_' + target.id] = Math.min(100, rel + gain);
                    addLog(`📜 ${ai.name} 向你遣使修好。`, "neutral");
                }
            }
            // AI 对其他 AI 的行为
            else {
                // 208年特殊：孙刘即将联盟
                const is208alliance = (gameState.currentScenario.id === 208 && 
                    ((ai.id === 'sun_quan' && target.id === 'liu_bei') || (ai.id === 'liu_bei' && target.id === 'sun_quan')));
                if(is208alliance) {
                    // 孙刘有概率结盟
                    if(chance < 0.3) {
                        gameState.relations[ai.id + '_to_' + target.id] = Math.min(100, rel + 5);
                    }
                }
                // 208年特殊：南匈奴骚扰曹操
                else if(gameState.currentScenario.id === 208 && ai.id === 'xiongnu' && target.id === 'cao_cao') {
                    if(chance < 0.2) {
                        gameState.relations[ai.id + '_to_' + target.id] -= Math.floor(5 + Math.random() * 8);
                        if(Math.random() < 0.25) addLog(`🐎 南匈奴骚扰魏国北境！`, "bad");
                    }
                }
                // 208年特殊：孟获骚扰刘璋
                else if(gameState.currentScenario.id === 208 && ai.id === 'meng_huo' && target.id === 'liu_zhang') {
                    if(chance < 0.15) {
                        gameState.relations[ai.id + '_to_' + target.id] -= Math.floor(3 + Math.random() * 5);
                        if(Math.random() < 0.2) addLog(`🏔️ 南蛮骚扰益州南境！`, "bad");
                    }
                }
                // 208年特殊：马腾骚扰曹操
                else if(gameState.currentScenario.id === 208 && ai.id === 'ma_teng' && target.id === 'cao_cao') {
                    if(chance < 0.15) {
                        gameState.relations[ai.id + '_to_' + target.id] -= Math.floor(3 + Math.random() * 5);
                        if(Math.random() < 0.2) addLog(`🐎 马腾骚扰魏国西境！`, "bad");
                    }
                }
                // 208年特殊：张鲁刘璋世仇
                else if(gameState.currentScenario.id === 208 && 
                       ((ai.id === 'zhang_lu' && target.id === 'liu_zhang') || 
                        (ai.id === 'liu_zhang' && target.id === 'zhang_lu'))) {
                    if(chance < 0.25) {
                        gameState.relations[ai.id + '_to_' + target.id] -= Math.floor(5 + Math.random() * 8);
                    }
                }
                // 215年特殊：马超倾向投奔刘备
                else if(gameState.currentScenario.id === 215 && ai.id === 'ma_chao' && target.id === 'liu_bei') {
                    if(chance < 0.3) {
                        gameState.relations[ai.id + '_to_' + target.id] = Math.min(100, rel + 5);
                    }
                }
                // 215年特殊：孙权索要荆州
                else if(gameState.currentScenario.id === 215 && ai.id === 'sun_quan' && target.id === 'liu_bei') {
                    if(chance < 0.15) {
                        gameState.relations[ai.id + '_to_' + target.id] -= Math.floor(3 + Math.random() * 5);
                    }
                }
                // 215年特殊：曹操防范孙权
                else if(gameState.currentScenario.id === 215 && ai.id === 'cao_cao' && target.id === 'sun_quan') {
                    if(chance < 0.15) {
                        gameState.relations[ai.id + '_to_' + target.id] -= Math.floor(3 + Math.random() * 5);
                    }
                }
                // 263年特殊：魏国持续施压蜀国
                else if(gameState.currentScenario.id === 263 && ai.id === 'simayi' && target.id === 'liu_shan') {
                    if(chance < 0.35) {
                        gameState.relations[ai.id + '_to_' + target.id] = Math.max(0, rel - 5);
                        if(Math.random() < 0.25) addLog(`⚔️ 魏军大举伐蜀！`, "bad");
                    }
                }
                // 263年特殊：吴国是否救援蜀国
                else if(gameState.currentScenario.id === 263 && ai.id === 'sun_hao' && target.id === 'liu_shan') {
                    if(chance < 0.15) {
                        gameState.relations[ai.id + '_to_' + target.id] += Math.floor(3 + Math.random() * 5);
                        if(Math.random() < 0.15) addLog(`📜 东吴出兵救援蜀汉！`, "good");
                    }
                }
                // 200年特殊：袁绍施压曹操
                else if(gameState.currentScenario.id === 200 && ai.id === 'yuan_shao' && target.id === 'cao_cao') {
                    if(chance < 0.25) {
                        gameState.relations[ai.id + '_to_' + target.id] -= Math.floor(5 + Math.random() * 10);
                        if(Math.random() < 0.2) addLog(`⚔️ 袁绍大军南下，官渡决战！`, "bad");
                    }
                }
                // 200年特殊：曹操轻敌
                else if(gameState.currentScenario.id === 200 && ai.id === 'cao_cao' && target.id === 'yuan_shao') {
                    if(chance < 0.15) {
                        gameState.relations[ai.id + '_to_' + target.id] -= Math.floor(3 + Math.random() * 5);
                    }
                }
                // 200年特殊：刘备投奔刘表倾向
                else if(gameState.currentScenario.id === 200 && ai.id === 'liu_bei' && target.id === 'liu_biao') {
                    if(chance < 0.25) {
                        gameState.relations[ai.id + '_to_' + target.id] = Math.min(100, rel + 5);
                    }
                }
                // 200年特殊：孙权观望
                else if(gameState.currentScenario.id === 200 && ai.id === 'sun_quan') {
                    if(chance < 0.1) {
                        // 孙权偶尔对曹操示好
                        if(target.id === 'cao_cao') {
                            gameState.relations[ai.id + '_to_' + target.id] += Math.floor(2 + Math.random() * 3);
                        }
                    }
                }
                // 200年特殊：张鲁刘璋世仇
                else if(gameState.currentScenario.id === 200 &&
                       ((ai.id === 'zhang_lu' && target.id === 'liu_zhang') ||
                        (ai.id === 'liu_zhang' && target.id === 'zhang_lu'))) {
                    if(chance < 0.2) {
                        gameState.relations[ai.id + '_to_' + target.id] -= Math.floor(3 + Math.random() * 5);
                    }
                }
                // 195年特殊：吕布威胁刘备
                else if(gameState.currentScenario.id === 195 && ai.id === 'lv_bu' && target.id === 'liu_bei') {
                    if(chance < 0.2) {
                        gameState.relations[ai.id + '_to_' + target.id] -= Math.floor(5 + Math.random() * 8);
                    }
                }
                // 195年特殊：袁绍施压曹操
                else if(gameState.currentScenario.id === 195 && ai.id === 'yuan_shao' && target.id === 'cao_cao') {
                    if(chance < 0.2) {
                        gameState.relations[ai.id + '_to_' + target.id] -= Math.floor(3 + Math.random() * 5);
                    }
                }
                // 195年特殊：孙策脱离袁术
                else if(gameState.currentScenario.id === 195 && ai.id === 'sun_ce' && target.id === 'yuan_shu') {
                    if(chance < 0.15) {
                        gameState.relations[ai.id + '_to_' + target.id] -= Math.floor(3 + Math.random() * 5);
                    }
                }
                // 195年特殊：刘备投奔刘表倾向
                else if(gameState.currentScenario.id === 195 && ai.id === 'liu_bei' && target.id === 'liu_biao') {
                    if(chance < 0.25) {
                        gameState.relations[ai.id + '_to_' + target.id] = Math.min(100, rel + 5);
                    }
                }
                // 184年特殊：黄巾三兄弟互相支援
                else if(gameState.currentScenario.id === 184 && 
                       (ai.id === 'zhang_jiao' || ai.id === 'zhang_bao' || ai.id === 'zhang_liang') &&
                       (target.id === 'zhang_jiao' || target.id === 'zhang_bao' || target.id === 'zhang_liang') &&
                       ai.id !== target.id) {
                    if(chance < 0.3) {
                        gameState.relations[ai.id + '_to_' + target.id] = Math.min(100, rel + 3);
                    }
                }
                // 184年特殊：汉军协同镇压黄巾
                else if(gameState.currentScenario.id === 184 && 
                       (ai.id === 'he_jin' || ai.id === 'lu_zhi' || ai.id === 'huangfu_song' || ai.id === 'zhu_jun') &&
                       (target.id === 'zhang_jiao' || target.id === 'zhang_bao' || target.id === 'zhang_liang')) {
                    if(chance < 0.25) {
                        gameState.relations[ai.id + '_to_' + target.id] -= Math.floor(3 + Math.random() * 5);
                        if(Math.random() < 0.15) addLog(`⚔️ ${ai.name}率军镇压黄巾！`, "neutral");
                    }
                }
                // 184年特殊：董卓积蓄力量
                else if(gameState.currentScenario.id === 184 && ai.id === 'dong_zhuo') {
                    if(chance < 0.15) {
                        gameState.stability = Math.max(0, gameState.stability - 2);
                        if(Math.random() < 0.1) addLog(`🐎 董卓在西凉暗中积蓄力量！`, "bad");
                    }
                }
                // 184年特殊：南匈奴骚扰
                else if(gameState.currentScenario.id === 184 && ai.id === 'xiongnu') {
                    if(chance < 0.2) {
                        gameState.relations[ai.id + '_to_' + target.id] -= Math.floor(2 + Math.random() * 3);
                        if(Math.random() < 0.15 && target.id === 'he_jin') addLog(`🏹 南匈奴南下劫掠边境！`, "bad");
                    }
                }
                // 184年特殊：公孙瓒讨黄巾
                else if(gameState.currentScenario.id === 184 && ai.id === 'gongsun_zan' &&
                       (target.id === 'zhang_jiao' || target.id === 'zhang_bao' || target.id === 'zhang_liang')) {
                    if(chance < 0.2) {
                        gameState.relations[ai.id + '_to_' + target.id] -= Math.floor(3 + Math.random() * 5);
                        if(Math.random() < 0.1) addLog(`🐎 公孙瓒率白马义从讨伐黄巾！`, "neutral");
                    }
                }
                // 184年特殊：袁术积蓄力量
                else if(gameState.currentScenario.id === 184 && ai.id === 'yuan_shu') {
                    if(chance < 0.15) {
                        gameState.relations[ai.id + '_to_' + target.id] = Math.min(100, rel + 2);
                        if(Math.random() < 0.1 && target.id === 'sun_jian') addLog(`⚡ 袁术与孙坚暗中联络！`, "neutral");
                    }
                }
                // 249年特殊：王凌酝酿反叛
                else if(gameState.currentScenario.id === 249 && ai.id === 'wang_ling' && target.id === 'simayi') {
                    if(chance < 0.25) {
                        gameState.relations[ai.id + '_to_' + target.id] -= Math.floor(5 + Math.random() * 8);
                        if(Math.random() < 0.2) addLog(`⚡ 王凌在寿春酝酿反叛司马氏！`, "bad");
                    }
                }
                // 249年特殊：姜维北伐
                else if(gameState.currentScenario.id === 249 && ai.id === 'liu_shan' && target.id === 'simayi') {
                    if(chance < 0.2) {
                        gameState.relations[ai.id + '_to_' + target.id] -= Math.floor(3 + Math.random() * 5);
                        if(Math.random() < 0.15) addLog(`⚔️ 姜维率军北伐！`, "good");
                    }
                }
                // 195年特殊：张鲁刘璋世仇
                else if(gameState.currentScenario.id === 195 &&
                       ((ai.id === 'zhang_lu' && target.id === 'liu_zhang') ||
                        (ai.id === 'liu_zhang' && target.id === 'zhang_lu'))) {
                    if(chance < 0.2) {
                        gameState.relations[ai.id + '_to_' + target.id] -= Math.floor(3 + Math.random() * 5);
                    }
                }
                // 190年特殊：孙坚讨董先锋
                else if(gameState.currentScenario.id === 190 && ai.id === 'sun_jian' && target.id === 'dong_zhuo') {
                    if(chance < 0.35) {
                        gameState.relations[ai.id + '_to_' + target.id] -= Math.floor(5 + Math.random() * 10);
                        if(Math.random() < 0.25) addLog(`⚔️ 孙坚讨董先锋，连战连捷！`, "good");
                    }
                }
                // 190年特殊：袁绍对韩馥的野心
                else if(gameState.currentScenario.id === 190 && ai.id === 'yuan_shao' && target.id === 'han_fu') {
                    if(chance < 0.2) {
                        gameState.relations[ai.id + '_to_' + target.id] -= Math.floor(3 + Math.random() * 5);
                    }
                }
                // 190年特殊：诸侯共击董卓
                else if(gameState.currentScenario.id === 190 && target.id === 'dong_zhuo' && ai.id !== 'dong_zhuo') {
                    if(chance < 0.15) {
                        gameState.relations[ai.id + '_to_' + target.id] -= Math.floor(2 + Math.random() * 3);
                    }
                }
                // 220年特殊：孙权依附曹丕
                const isVassalAI = (gameState.currentScenario.id === 220 && ai.id === 'sun_quan' && target.id === 'cao_pi');
                if(isVassalAI) {
                    // 孙权定期向曹丕进贡
                    if(chance < 0.35) {
                        gameState.relations[ai.id + '_to_' + target.id] = Math.min(100, rel + 3);
                    }
                }
                // 220年特殊：刘备与孙权关系恶劣
                else if(gameState.currentScenario.id === 220 && 
                       ((ai.id === 'liu_bei' && target.id === 'sun_quan') || 
                        (ai.id === 'sun_quan' && target.id === 'liu_bei'))) {
                    // 刘孙互相敌视
                    if(chance < 0.25) {
                        gameState.relations[ai.id + '_to_' + target.id] -= Math.floor(5 + Math.random() * 10);
                    }
                }
                // 220年特殊：匈奴觊觎曹魏边境
                else if(gameState.currentScenario.id === 220 && ai.id === 'xiongnu' && target.id === 'cao_pi') {
                    // 匈奴时常骚扰曹魏边境
                    if(chance < 0.2) {
                        gameState.relations[ai.id + '_to_' + target.id] -= Math.floor(5 + Math.random() * 8);
                        if(Math.random() < 0.3) addLog(`🐎 南匈奴骚扰魏国边境！`, "bad");
                    }
                }
                // 220年特殊：曹魏对匈奴的防范
                else if(gameState.currentScenario.id === 220 && ai.id === 'cao_pi' && target.id === 'xiongnu') {
                    // 曹魏对匈奴时而安抚时而威慑
                    if(chance < 0.15) {
                        gameState.relations[ai.id + '_to_' + target.id] -= Math.floor(3 + Math.random() * 5);
                    } else if(chance < 0.3) {
                        gameState.relations[ai.id + '_to_' + target.id] += Math.floor(2 + Math.random() * 3);
                    }
                }
                // 关系极低 + 实力碾压 → 背刺
                else if (rel < 15 && ratio > 1.5 && chance < 0.2) {
                    gameState.relations[ai.id + '_to_' + target.id] -= 20;
                    addLog(`⚔️ ${ai.name} 对 ${target.name} 发动挑衅！`, "bad");
                }
                // 关系高 → 遣使维系
                else if (rel >= 60 && chance < 0.45) {
                    const gain = Math.floor(3 + Math.random() * 5);
                    gameState.relations[ai.id + '_to_' + target.id] = Math.min(100, rel + gain);
                }
                // 势均力敌且关系好 → 可能结盟
                else if (rel >= 75 && ratio >= 0.6 && ratio <= 1.6 && chance < 0.15) {
                    gameState.relations[ai.id + '_to_' + target.id] = Math.min(100, rel + 10);
                    addLog(`🤝 ${ai.name} 与 ${target.name} 达成默契同盟。`, "neutral");
                }
                // 中等关系 → 自然互动
                else if (chance < 0.3) {
                    const gain = Math.floor(2 + Math.random() * 4);
                    gameState.relations[ai.id + '_to_' + target.id] = Math.min(100, rel + gain);
                }
            }
        });
    });
    
    // 刷新外交面板（如果打开的话）
    const dipPopup = document.getElementById('dip-popup');
    if (dipPopup && dipPopup.classList.contains('show')) {
        renderDipPopup();
    }
}


// === 计算最大行动力 ===
function getMaxAP() {
    const myId = gameState.selectedLord.id;
    const cityCount = gameState.citiesData.filter(c => c.owner === myId).length;
    // 基础 5 点，每 10 座城增加 1 点
    let cap = 5 + Math.floor(cityCount / 10);
    return cap;
}

function processMonthEnd() {
    gameState.month++; if(gameState.month > 12) { gameState.month = 1; gameState.year++; }
    
    const myId = gameState.selectedLord.id;
    const myCities = gameState.citiesData.filter(c => c.owner === myId);
    
    // === 先计算稳定度 ===
    gameState.stability = calculateStability();
    
    // === 稳定度对税收的影响 ===
    let stabMod = 1.0;
    if(gameState.stability >= 85) stabMod = 1.2;
    else if(gameState.stability >= 65) stabMod = 1.0;
    else if(gameState.stability >= 45) stabMod = 0.9;
    else if(gameState.stability >= 25) stabMod = 0.75;
    else stabMod = 0.5;
    
    // === 财政收入 ===
    let totalIncome = 0;
    myCities.forEach(c => {
        const taxIncome = Math.floor(c.base_pop / 100 * stabMod);
        totalIncome += taxIncome;
    });
    gameState.playerGold += totalIncome;
    
    // === 粮草结算 ===
    let totalGrainIncome = 0;
    let totalGrainCost = 0;
    myCities.forEach(c => {
        // 基础粮草产出
        const grainProd = 500 + Math.floor(c.base_pop / 50);
        totalGrainIncome += grainProd;
        // 军队粮草消耗：每 100 兵消耗 1 粮
        const troopCost = Math.floor(c.currentTroops / 100);
        totalGrainCost += troopCost;
    });
    
    // 净粮草 = 产出 - 消耗
    const netGrain = totalGrainIncome - totalGrainCost;
    myCities.forEach(c => {
        const share = Math.floor(netGrain / (myCities.length || 1));
        c.currentGrain += share;
    });
    
    // 如果粮草不足，军队士气下降（兵力减少）
    if(netGrain < 0) {
        myCities.forEach(c => {
            const desert = Math.floor(c.currentTroops * 0.05); // 5% 逃兵
            c.currentTroops -= desert;
            addLog(`⚠️ ${c.name} 缺粮！${desert.toLocaleString()} 士兵逃散`, "bad");
        });
        gameState.morale = Math.max(0, gameState.morale - 3); // 缺粮降士气
    }
    
    // 每回合士气自然衰减（-1~2）
    const moraleDecay = 1 + Math.floor(Math.random() * 2);
    gameState.morale = Math.max(0, gameState.morale - moraleDecay);
    
        gameState.maxAp = getMaxAP();
    gameState.ap = gameState.maxAp;
    
    // AI 自动外交
    runAIDiplomacy();
    
    const moraleInfo = getMoraleBonus(gameState.morale);
    const stabInfo = getStabilityInfo(gameState.stability);
    const stabModStr = stabMod === 1.0 ? '' : ` (税收×${stabMod.toFixed(1)})`;
    const logMsg = netGrain < 0 ? `📅 ${gameState.year} 年 ${gameState.month} 月 | 收入金 ${totalIncome}${stabModStr}，粮草短缺！士气 ${gameState.morale} ${stabInfo.label}` :
                   `📅 ${gameState.year} 年 ${gameState.month} 月 | 收入金 ${totalIncome}${stabModStr}，粮草+${netGrain}，士气 ${gameState.morale} ${stabInfo.label}`;
    updateHUD(); updateStabilityPanel(); updateMyFactionPanel(); addLog(logMsg, netGrain < 0 ? "bad" : "neutral");
}
function updateHUD() { document.getElementById('hud-time').innerText = `${gameState.year} 年 ${gameState.month} 月`; document.getElementById('hud-ap').innerText = `${gameState.ap}/${gameState.maxAp}`; }

function togglePanel(id) { const p = document.getElementById('panel-'+id); p.style.display = (p.style.display==='block')?'none':'block'; if(id!=='war') document.getElementById('panel-war').style.display='none'; }
// === 稳定度系统 v3.0 ===
function getStabilityInfo(stab) {
    if(stab >= 85) return { label: '🏛️ 国泰民安', color: '#ffd700', desc: '政通人和，百业兴旺' };
    if(stab >= 65) return { label: '✅ 政局稳定', color: '#4caf50', desc: '民心安定，运转正常' };
    if(stab >= 45) return { label: '😐 暗流涌动', color: '#ff9800', desc: '偶有不满，需加强管控' };
    if(stab >= 25) return { label: '😰 动荡不安', color: '#ff5722', desc: '民怨沸腾，叛乱风险高' };
    return { label: '💀 天下大乱', color: '#f44336', desc: '随时可能爆发叛乱！' };
}

function calculateStability() {
    const myId = gameState.selectedLord.id;
    const myCities = gameState.citiesData.filter(c => c.owner === myId);
    const cityCount = myCities.length;
    
    if(cityCount === 0) return 0;
    
    // 基础稳定度
    let stab = 60;
    
    // 城池数量影响（城多难管）
    if(cityCount <= 5) stab += 10;
    else if(cityCount <= 15) stab += 5;
    else if(cityCount <= 30) stab -= 5;
    else if(cityCount <= 50) stab -= 15;
    else stab -= 25;
    
    // 士气影响
    stab += (gameState.morale - 70) * 0.3;
    
    // 粮草状况影响
    let totalTroops = myCities.reduce((s, c) => s + c.currentTroops, 0);
    let totalGrain = myCities.reduce((s, c) => s + c.currentGrain, 0);
    let grainNeed = totalTroops / 100;
    if(grainNeed > 0) {
        let grainRatio = totalGrain / grainNeed;
        if(grainRatio > 2) stab += 8;
        else if(grainRatio > 1) stab += 3;
        else if(grainRatio > 0.5) stab -= 5;
        else stab -= 15;
    }
    
    // 城池分散度（领土连贯性）
    if(cityCount > 1) {
        let connected = 0;
        let total = 0;
        for(let i = 0; i < cityCount; i++) {
            for(let j = i + 1; j < cityCount; j++) {
                total++;
                const dist = Math.sqrt(
                    Math.pow(myCities[i].x - myCities[j].x, 2) + 
                    Math.pow(myCities[i].y - myCities[j].y, 2)
                );
                if(dist < 200) connected++;
            }
        }
        const cohesion = total > 0 ? connected / total : 0;
        stab += (cohesion - 0.5) * 20;
    }
    
    // 黄金储备影响
    if(gameState.playerGold > 5000) stab += 5;
    else if(gameState.playerGold > 2000) stab += 2;
    else if(gameState.playerGold < 500) stab -= 8;
    
    return Math.max(0, Math.min(100, Math.round(stab)));
}

function updateStabilityPanel() {
    const panel = document.getElementById('stab-summary');
    const details = document.getElementById('stability-details');
    if(!panel || !details) return;
    
    // 计算玩家稳定度
    gameState.stability = calculateStability();
    const myInfo = getStabilityInfo(gameState.stability);
    
    panel.innerText = myInfo.label;
    panel.style.color = myInfo.color;
    
    // 生成天下势力稳定度排行
    let html = `<div style="padding:6px; font-size:12px;">`;
    
    // 1. 玩家自己的势力 (置顶高亮)
    html += `<div style="margin-bottom:6px; padding-bottom:6px; border-bottom:1px solid #ffd700;">
        <div style="display:flex; justify-content:space-between;">
            <span style="color:#ffd700; font-weight:bold;">👑 ${gameState.selectedLord.name}</span>
            <span style="color:${myInfo.color}; font-weight:bold;">${myInfo.label} (${gameState.stability})</span>
        </div>
    </div>`;

    // 2. 计算并显示其他势力的稳定度
    const counts = {};
    gameState.citiesData.forEach(c => { counts[c.owner] = (counts[c.owner]||0)+1; });
    const lords = SCENARIO_LORDS[gameState.currentScenario.id] || [];
    
    // 按城池数排序
    const sortedLords = lords.map(l => ({...l, cities: counts[l.id] || 0})).sort((a,b) => b.cities - a.cities);
    
    sortedLords.forEach(lord => {
        if(lord.id === gameState.selectedLord.id || lord.cities === 0) return;
        
        // 简易估算稳定度
        let estimatedStab = 70;
        if(lord.cities > 10) estimatedStab = 70 - (lord.cities - 10) * 2;
        else estimatedStab = 70 + (10 - lord.cities) * 1;
        estimatedStab = Math.max(0, Math.min(100, estimatedStab));
        
        const info = getStabilityInfo(estimatedStab);
        html += `<div style="margin:4px 0; display:flex; justify-content:space-between;">
            <span style="color:${lord.color};">${lord.name} <span style="color:#666;font-size:10px;">(${lord.cities}城)</span></span>
            <span style="color:${info.color}; font-size:11px;">${info.label} (${estimatedStab})</span>
        </div>`;
    });
    // 叛乱检查 (低稳定度)
    const myId = gameState.selectedLord.id;
    const myCities = gameState.citiesData.filter(c => c.owner === myId);
    if(gameState.stability < 20 && Math.random() < 0.15 && myCities.length > 0) {
        const rebelCity = myCities[Math.floor(Math.random() * myCities.length)];
        if(rebelCity) {
            rebelCity.owner = 'rebel'; 
            rebelCity.ownerName = '叛军'; 
            rebelCity.ownerColor = '#f44336';
            addLog(`🚨 【天下大势】${rebelCity.name} 爆发叛乱！城池落入叛军手中！`, "bad");
            initGameMap();
        }
    }
    
    html += `</div>`;
    details.innerHTML = html;
}

function toggleStability() {
    const d = document.getElementById('stability-details');
    d.style.display = (d.style.display === 'block') ? 'none' : 'block';
}
function toggleStability() { const d = document.getElementById('stability-details'); d.style.display = (d.style.display==='block')?'none':'block'; }

function addLog(msg, type="neutral") {
    const log = document.getElementById('log-content');
    const item = document.createElement('div'); item.className = 'log-item ' + (type==='good'?'log-good':(type==='bad'?'log-bad':''));
    item.innerText = msg; log.prepend(item); if(log.children.length > 20) log.lastChild.remove();
}

function renderScenarios() { const box = document.getElementById('scenario-list'); box.innerHTML = ''; SCENARIOS.forEach(s => { const c = document.createElement('div'); c.className = 'scenario-card'; c.onclick = () => showLordSelect(s.id); c.innerHTML = `<h3>${s.year}年 - ${s.title}</h3><p>${s.desc}</p>`; box.appendChild(c); }); }
function renderLords(id) {
    const box = document.getElementById('lord-list'); box.innerHTML = '';
    SCENARIO_LORDS[id].forEach(l => {
        const c = document.createElement('div'); c.id = 'lord-card-'+l.id; c.className = 'lord-card'; c.onclick = () => selectLord(l.id);
        c.innerHTML = `<div class="lord-portrait"><img src="images/portraits/${l.id}.png" onerror="this.src='images/portraits/default.png'"></div><div style="color:${l.color}; font-weight:bold; margin-bottom:3px;">${l.name}</div><div style="font-size:11px; color:#888;">${l.faction}</div>`;
        box.appendChild(c);
    });
}

// === 我的势力面板 ===

function updateMyFactionPanel() {
    if (!gameState.selectedLord) return;
    const myId = gameState.selectedLord.id;
    let cities = 0, pop = 0, troops = 0, grain = 0;
    
    gameState.citiesData.forEach(city => {
        if (city.owner === myId) {
            cities++;
            pop += city.base_pop;
            troops += city.currentTroops;
            grain += (city.currentGrain || 0);
        }
    });
    
    document.getElementById('mf-cities').innerText = cities;
    document.getElementById('mf-pop').innerText = (pop / 10000).toFixed(1) + '万';
    document.getElementById('mf-troops').innerText = troops;
    document.getElementById('mf-gold').innerText = gameState.playerGold;
    document.getElementById('mf-grain').innerText = grain;
    
    updateMoralePanel();
}

// === 更新士气看板 ===
function updateMoralePanel() {
    const morale = gameState.morale;
    const info = getMoraleBonus(morale);
    
    const labelEl = document.getElementById('morale-label');
    const barEl = document.getElementById('morale-bar-fill');
    const descEl = document.getElementById('morale-desc');
    const bonusEl = document.getElementById('morale-bonus');
    
    if(labelEl) {
        labelEl.innerText = morale;
        labelEl.style.color = morale >= 75 ? '#4caf50' : morale >= 55 ? '#ffd700' : morale >= 35 ? '#ff9800' : '#f44336';
    }
    if(barEl) {
        barEl.style.width = morale + '%';
        barEl.style.background = morale >= 75 ? 'linear-gradient(90deg, #4caf50, #81c784)' : 
                                   morale >= 55 ? 'linear-gradient(90deg, #ffd700, #ffca28)' : 
                                   morale >= 35 ? 'linear-gradient(90deg, #ff9800, #ffb74d)' : 
                                   'linear-gradient(90deg, #f44336, #ef5350)';
    }
    if(descEl) descEl.innerText = info.label;
    if(bonusEl) {
        const atkStr = info.atkMod >= 1 ? `<span class="atk-up">⚔️ 攻击 +${Math.round((info.atkMod-1)*100)}%</span>` :
                                         `<span class="atk-down">⚔️ 攻击 ${Math.round((info.atkMod-1)*100)}%</span>`;
        const defStr = info.defMod >= 1 ? `<span class="atk-up">🛡️ 防御 +${Math.round((info.defMod-1)*100)}%</span>` :
                                          `<span class="atk-down">🛡️ 防御 ${Math.round((info.defMod-1)*100)}%</span>`;
        bonusEl.innerHTML = `${atkStr}<br>${defStr}`;
    }
}


// === 外交系统 v3.0 ===
function getFactionName(id) {
    const lords = SCENARIO_LORDS[gameState.currentScenario.id];
    if(!lords) return id;
    const l = lords.find(x => x.id === id);
    return l ? l.name : id;
}

// === 势力强弱系统 ===
function getFactionStrength(fid) {
    return gameState.citiesData.filter(c => c.owner === fid).length;
}

function getPowerInfo(fid) {
    const myStr = getFactionStrength(gameState.selectedLord.id);
    const targetStr = getFactionStrength(fid);
    const myCities = myStr || 1;

    
    if (ratio >= 2.0) return { label: '碾压我方', icon: '⚠️', color: '#f44336', mult: 2.0 };
    if (ratio >= 1.5) return { label: '强于我方', icon: '⬆️', color: '#ff9800', mult: 1.5 };
    if (ratio >= 0.7) return { label: '势均力敌', icon: '⚖️', color: '#9e9e9e', mult: 1.0 };
    if (ratio >= 0.4) return { label: '弱于我方', icon: '⬇️', color: '#4caf50', mult: 0.8 };
    return { label: '远逊我方', icon: '🐜', color: '#2196f3', mult: 0.5 };
}

function getRelInfo(rel) {
    if (rel >= 95) return { label: '同盟', color: '#ffd700', bg: '#FFD70022', desc: '攻守同盟，荣辱与共' };
    if (rel >= 85) return { label: '盟好', color: '#60a5fa', bg: '#60a5fa22', desc: '互不侵犯，可互通有无' };
    if (rel >= 65) return { label: '友善', color: '#4caf50', bg: '#4caf5022', desc: '态度友好，不会主动攻击' };
    if (rel >= 36) return { label: '中立', color: '#9e9e9e', bg: '#9e9e9e22', desc: '不冷不热，各安天命' };
    if (rel >= 16) return { label: '敌对', color: '#ff9800', bg: '#ff980022', desc: '关系紧张，可能被攻击' };
    return { label: '世仇', color: '#f44336', bg: '#f4433622', desc: '势同水火，不共戴天' };
}

function toggleDipPopup() {
    const popup = document.getElementById('dip-popup');
    if(!popup) return;
    
    if(popup.style.display === 'none' || popup.style.display === '') {
        popup.style.display = 'block';
        renderDipPopup();
    } else {
        popup.style.display = 'none';
        backToDipList();
    }
}

function closeDipPopup() {
    console.log("🔴 Closing diplomacy popup");
    const popup = document.getElementById('dip-popup');
    if(popup) {
        popup.style.display = 'none';
    }
    // Also reset the detail view inside
    backToDipList();
}


function doDipAction(fid, type) {
    if(gameState.ap < 1) { addLog("⚠️ 行动力不足！", "bad"); return; }
    const pw = getPowerInfo(fid);
    let goldCost = 0, apCost = 1, relChange = 0, log = "", extraEffect = "";
    
    if(type === 'envoy') {
        apCost = 1; goldCost = 0;
        // 对强势力效果衰减，对弱势力效果增强
        relChange = Math.floor((8 + Math.random()*8) / pw.mult);
        log = "📜 遣使拜访";
    }
    else if(type === 'gift') {
        apCost = 1; goldCost = Math.round(300 * pw.mult);
        relChange = Math.floor(15 + Math.random()*11);
        log = "🎁 赠送金帛";
    }
    else if(type === 'provoke') {
        apCost = 1; goldCost = 0;
        // 对弱势力挑衅效果更明显，对强势力挑衅效果差
        relChange = -(Math.floor((15 + Math.random()*11) / pw.mult));
        log = "😡 恶言挑衅";
    }
    else if(type === 'borrow') {
        const rel = gameState.relations[fid] || 50;
        // 对强势力借粮门槛更高
        const borrowReq = pw.mult >= 1.5 ? 85 : (pw.mult >= 1.0 ? 75 : 65);
        if(rel < borrowReq) { addLog(`⚠️ 关系不足 ${borrowReq}，对方拒绝借粮！`, "bad"); return; }
        apCost = 1; goldCost = 0; relChange = -5;
        // 对强势力借到的更多
        const grainGain = Math.round((1000 + Math.random() * 1000) * pw.mult);
        let distributed = 0;
        const myCities = gameState.citiesData.filter(c => c.owner === gameState.selectedLord.id);
        myCities.forEach(c => { const share = Math.floor(grainGain / (myCities.length||1)); c.currentGrain += share; distributed += share; });
        extraEffect = `，借得粮草 ${grainGain}`;
        log = "📮 请求借粮";
    }
    
    if(gameState.playerGold < goldCost) { addLog(`⚠️ 黄金不足！需要 ${goldCost}`, "bad"); return; }
    if(gameState.ap < apCost) { addLog(`⚠️ 行动力不足！需要 ${apCost}`, "bad"); return; }
    
    gameState.playerGold -= goldCost; gameState.ap = Math.max(0, gameState.ap - apCost);
    gameState.relations[fid] = Math.max(0, Math.min(100, (gameState.relations[fid]||50) + relChange));
    addLog(`${log} ${getFactionName(fid)}${pw.mult !== 1.0 ? ` (${pw.label} x${pw.mult.toFixed(1)})` : ''}，关系变动 ${relChange>0?'+':''}${relChange}${extraEffect}`, relChange>0?"good":"bad");
    renderDipPopup(); updateMyFactionPanel();
}

function doSowDiscord(fid, cost) {
    const pw = getPowerInfo(fid);
    const apNeeded = pw.mult >= 1.5 ? 3 : 2;
    if(gameState.ap < apNeeded) { addLog(`⚠️ 行动力不足！需要 ${apNeeded} 点`, "bad"); return; }
    if(gameState.playerGold < cost) { addLog(`⚠️ 黄金不足！需要 ${cost}`, "bad"); return; }
    
    const lords = SCENARIO_LORDS[gameState.currentScenario.id] || [];
    const myId = gameState.selectedLord.id;
    const thirdParties = lords.filter(l => l.id !== myId && l.id !== fid);
    if(thirdParties.length === 0) { addLog("⚠️ 无离间目标！", "bad"); return; }
    
    const target = thirdParties[Math.floor(Math.random()*thirdParties.length)];
    // 对强势力离间效果衰减
    const drop = Math.floor((15 + Math.random()*16) / pw.mult);
    
    gameState.ap = Math.max(0, gameState.ap - apNeeded); gameState.playerGold -= cost;
    gameState.relations[target.id] = Math.max(0, (gameState.relations[target.id]||50) - drop);
    
    addLog(`🗡️ 离间 ${getFactionName(fid)} 与 ${target.name}！关系下降 ${drop}`, "good");
    renderDipPopup(); updateMyFactionPanel();
}

function doAlliance(fid) {
    const pw = getPowerInfo(fid);
    // 结盟门槛随势力强弱调整
    let allianceReq = 85;
    if (pw.mult >= 2.0) allianceReq = 98;
    else if (pw.mult >= 1.5) allianceReq = 95;
    else if (pw.mult <= 0.5) allianceReq = 70;
    
    const apNeeded = pw.mult >= 1.5 ? 5 : 3;
    if(gameState.ap < apNeeded) { addLog(`⚠️ 结盟需要 ${apNeeded} 点行动力！`, "bad"); return; }
    const rel = gameState.relations[fid] || 50;
    if(rel < allianceReq) { addLog(`⚠️ 关系不足 ${allianceReq}，无法结盟！`, "bad"); return; }
    if(!confirm(`确定消耗 ${apNeeded} 点行动力与 ${getFactionName(fid)} 结成同盟吗？`)) return;
    
    gameState.ap = Math.max(0, gameState.ap - apNeeded);
    gameState.relations[fid] = Math.min(100, rel + 10);
    addLog(`🤝 与 ${getFactionName(fid)} 正式结成同盟！攻守与共！`, "good");
    renderDipPopup();
}

function forceNextTurn() {
    stopAutoTime();
    currentDay = 1;
    processMonthEnd();
    const dayEl = document.getElementById('hud-day');
    if(dayEl) dayEl.innerText = "第 1/30 天";
}

function toggleAutoTime() {
    if (gameTimer) {
        stopAutoTime();
        const btn = document.getElementById('btn-timer');
        if(btn) btn.innerText = '▶️ 自动流逝';
    } else {
        gameTimer = setInterval(() => {
            currentDay++;
            const dayEl = document.getElementById('hud-day');
            if(dayEl) dayEl.innerText = `第 ${currentDay}/30 天`;
            if (currentDay > 30) {
                currentDay = 1;
                forceNextTurn();
            }
        }, 1000);
        const btn = document.getElementById('btn-timer');
        if(btn) btn.innerText = '⏸️ 暂停时间';
    }
}

function stopAutoTime() {
    if (gameTimer) {
        clearInterval(gameTimer);
        gameTimer = null;
    }
}

function nextTurn() {
    forceNextTurn();
}
