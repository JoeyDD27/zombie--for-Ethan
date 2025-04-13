console.log("Content script loaded!");

class Projectile {
  constructor(x, y, targetX, targetY, damage, sourceZombie) {
    this.sourceZombie = sourceZombie;
    this.element = document.createElement('div');
    this.element.className = 'projectile';
    this.element.style.width = '20px';
    this.element.style.height = '20px';
    this.element.style.borderRadius = '50%';
    this.x = x;
    this.y = y;
    this.damage = damage;

    // Calculate direction
    const angle = Math.atan2(targetY - y, targetX - x);
    this.dx = Math.cos(angle) * 10; // Quick speed for arrows
    this.dy = Math.sin(angle) * 10;

    this.element.style.left = this.x + 'px';
    this.element.style.top = this.y + 'px';
    document.body.appendChild(this.element);
  }

  move() {
    this.x += this.dx;
    this.y += this.dy;
    this.element.style.left = this.x + 'px';
    this.element.style.top = this.y + 'px';
  }
}

class Zombie {
  constructor(type = 'fighter') {
    this.type = type;
    this.element = document.createElement('div');
    this.element.className = `zombie ${type}`;
    this.size = 50;
    this.isCrowned = false;
    this.isOP = false;
    this.lastAttackTime = 0;
    this.lastAoeDamageTime = 0;
    this.aoeDamageInterval = 1000;
    this.lastHealTime = 0;
    this.healInterval = 1000;
    this.healAmount = 10;

    // Create container for emojis
    this.emojiContainer = document.createElement('div');
    this.emojiContainer.className = 'emoji-container';
    this.element.appendChild(this.emojiContainer);

    // Create HP display element
    this.hpDisplay = document.createElement('span');
    this.hpDisplay.className = 'hp-display';
    this.element.appendChild(this.hpDisplay);

    // Set propertis ebased on type
    switch (type) {
      case 'archer':
        this.hp = 400;
        this.damage = 20;
        this.speed = 5;
        this.cooldown = 500;
        this.range = 400;
        break;
      case 'fighter':
        this.hp = 450;
        this.damage = 40;
        this.speed = 3;
        this.cooldown = 1000;
        this.range = 50;
        break;
      case 'tank':
        this.hp = 600;
        this.damage = 30;
        this.speed = 2;
        this.cooldown = 1500;
        this.range = 50;
        break;
    }

    // Set initial HP display
    this.updateHpDisplay();

    // Create menu
    this.menu = document.createElement('div');
    this.menu.className = 'zombie-menu';

    const opOption = document.createElement('div');
    opOption.className = 'menu-option OP';
    opOption.textContent = 'OP';
    opOption.addEventListener('click', (e) => {
      e.stopPropagation();
      this.makeOP();
    });

    const crownOption = document.createElement('div');
    crownOption.className = 'menu-option crown';
    crownOption.textContent = 'Crown';
    crownOption.addEventListener('click', (e) => {
      e.stopPropagation();
      this.crown();
    });

    this.menu.appendChild(opOption);
    this.menu.appendChild(crownOption);
    document.body.appendChild(this.menu);

    // Add click listener for menu
    this.element.addEventListener('click', (e) => {
      e.stopPropagation();
      this.showMenu(e.clientX, e.clientY);
    });

    // Hide menu when clicking elsewhere
    document.addEventListener('click', (e) => {
      if (!this.menu.contains(e.target)) {
        this.hideMenu();
      }
    });

    this.x = Math.random() * (window.innerWidth - this.size);
    this.y = Math.random() * (window.innerHeight - this.size);
    this.element.style.left = this.x + 'px';
    this.element.style.top = this.y + 'px';
    document.body.appendChild(this.element);
  }

  showMenu(x, y) {
    this.menu.style.left = x + 'px';
    this.menu.style.top = y + 'px';
    this.menu.classList.add('visible');
  }

  hideMenu() {
    this.menu.classList.remove('visible');
  }

  makeOP() {
    if (this.isOP) return;
    this.isOP = true;
    this.element.classList.add('OP');

    // Add OP emoji without clearing existing emojis
    const opEmoji = document.createElement('div');
    opEmoji.className = 'status-emoji OP';
    opEmoji.textContent = '🕳️'; // Black hole emoji
    this.emojiContainer.appendChild(opEmoji);

    switch (this.type) {
      case 'archer':
        this.cooldown = 100;
        this.healAmount = 15;
        break;
      case 'fighter':
        this.speed = 12;
        this.damage = 30;
        this.healAmount = 30;
        this.aoeDamageInterval = 500;
        this.aoeRadius = 150;
        this.aoeDamage = 30;
        break;
      case 'tank':
        this.hp += 500;
        this.damage += 40;
        this.healAmount = 20;
        this.speed += 1;
        break;
    }

    this.updateHpDisplay();
    this.hideMenu();
  }

  crown() {
    if (this.isCrowned) return;
    this.isCrowned = true;
    this.element.classList.add('crowned');

    // Only add crown emoji if not OP
    if (!this.isOP) {
      // Add crown emoji without clearing existing emojis
      const crownEmoji = document.createElement('div');
      crownEmoji.className = 'status-emoji crown';
      crownEmoji.textContent = '👑';
      this.emojiContainer.appendChild(crownEmoji);
    }

    this.hp += 100;
    this.damage = Math.floor(this.damage * 1.2);
    this.healAmount = 15;
    this.updateHpDisplay();
    this.hideMenu();
  }

  move() {
    const target = this.findTarget();
    const now = Date.now();

    // Add healing for crowned and OP zombies
    if ((this.isCrowned || this.isOP) && now - this.lastHealTime >= this.healInterval) {
      this.lastHealTime = now;
      this.hp += this.healAmount;
      this.updateHpDisplay();
    }

    if (!target) return;

    const dx = target.x - this.x;
    const dy = target.y - this.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    const angle = Math.atan2(dy, dx);

    if (this.type === 'archer') {
      // Archer movement
      if (distance < 200) {
        // Run away if too close
        this.x -= Math.cos(angle) * this.speed;
        this.y -= Math.sin(angle) * this.speed;
      } else if (distance > 300) {
        // Move closer if too far
        this.x += Math.cos(angle) * this.speed;
        this.y += Math.sin(angle) * this.speed;
      }
      // Attack from any distance
      if (now - this.lastAttackTime >= this.cooldown) {
        this.attack(target);
      }
    } else {
      // Fighter and Tank movement
      if (distance > this.range) {
        // Move towards target
        this.x += Math.cos(angle) * this.speed;
        this.y += Math.sin(angle) * this.speed;
      }
      // Attack if in range
      if (distance <= this.range && now - this.lastAttackTime >= this.cooldown) {
        this.attack(target);
      }
    }

    // Keep zombies within screen bounds
    this.x = Math.max(0, Math.min(window.innerWidth - this.size, this.x));
    this.y = Math.max(0, Math.min(window.innerHeight - this.size, this.y));

    this.element.style.left = this.x + 'px';
    this.element.style.top = this.y + 'px';

    // Add AOE damage for OP fighters
    if (this.isOP && this.type === 'fighter' && Date.now() - this.lastAoeDamageTime >= this.aoeDamageInterval) {
      this.lastAoeDamageTime = Date.now();
      for (let zombie of zombies) {
        if (zombie !== this) {
          const dx = zombie.x - this.x;
          const dy = zombie.y - this.y;
          const distance = Math.sqrt(dx * dx + dy * dy);
          if (distance < this.aoeRadius) {
            zombie.hp -= this.aoeDamage;
            zombie.updateHpDisplay();
            if (zombie.hp <= 0) {
              zombie.element.remove();
            }
          }
        }
      }
    }
  }

  attack(target) {
    if (Date.now() - this.lastAttackTime < this.cooldown) return;
    this.lastAttackTime = Date.now();

    if (this.type === 'archer') {
      const projectile = new Projectile(
        this.x + this.size / 2,
        this.y + this.size / 2,
        target.x + target.size / 2,
        target.y + target.size / 2,
        this.damage,
        this
      );
      projectiles.push(projectile);
    } else {
      // Melee attack
      target.hp -= this.damage;
      target.updateHpDisplay();

      if (target.hp <= 0) {
        // Gain 20 HP on kill
        this.hp += 20;
        this.updateHpDisplay();

        if (target.isCrowned && this) {
          this.crown();
        }
        target.element.remove();
      }
    }
  }

  isInCorner() {
    const margin = 50;
    return (
      (this.x <= margin && this.y <= margin) || // Top-left
      (this.x <= margin && this.y >= window.innerHeight - margin) || // Bottom-left
      (this.x >= window.innerWidth - margin && this.y <= margin) || // Top-right
      (this.x >= window.innerWidth - margin && this.y >= window.innerHeight - margin) // Bottom-right
    );
  }

  getValidEscapeDirections() {
    const directions = [];
    const margin = 50;

    // Check which directions are valid based on position
    if (this.x > margin) directions.push({ x: -1, y: 0 }); // Left
    if (this.x < window.innerWidth - margin) directions.push({ x: 1, y: 0 }); // Right
    if (this.y > margin) directions.push({ x: 0, y: -1 }); // Up
    if (this.y < window.innerHeight - margin) directions.push({ x: 0, y: 1 }); // Down

    // Add diagonal movements if both corresponding cardinal directions are valid
    if (this.x > margin && this.y > margin) directions.push({ x: -1, y: -1 }); // Up-left
    if (this.x > margin && this.y < window.innerHeight - margin) directions.push({ x: -1, y: 1 }); // Down-left
    if (this.x < window.innerWidth - margin && this.y > margin) directions.push({ x: 1, y: -1 }); // Up-right
    if (this.x < window.innerWidth - margin && this.y < window.innerHeight - margin) directions.push({ x: 1, y: 1 }); // Down-right

    return directions;
  }

  chooseBestEscapeDirection(directions, target) {
    let bestDirection = directions[0];
    let maxDistance = 0;

    for (const dir of directions) {
      // Calculate where this direction would lead
      const newX = this.x + dir.x * 50;
      const newY = this.y + dir.y * 50;

      // Calculate distance to target from this new position
      const distance = Math.sqrt(
        Math.pow(target.x - newX, 2) +
        Math.pow(target.y - newY, 2)
      );

      // Update best direction if this creates more distance
      if (distance > maxDistance) {
        maxDistance = distance;
        bestDirection = dir;
      }
    }

    return bestDirection;
  }

  handleProjectileHit(projectile, zombie) {
    zombie.lastAttacker = projectile.sourceZombie;
    zombie.hp -= projectile.damage;
    zombie.element.textContent = zombie.hp;

    if (zombie.hp <= 0) {
      if (zombie.isCrowned && projectile.sourceZombie) {
        projectile.sourceZombie.crown();
      }
      zombie.element.remove();
    }
    return true;
  }

  findTarget() {
    let nearestTarget = null;
    let nearestDistance = Infinity;

    for (let other of zombies) {
      if (other === this) continue;

      const dx = other.x - this.x;
      const dy = other.y - this.y;
      const distance = Math.sqrt(dx * dx + dy * dy);

      // 60% chance targeting logic - removed type restrictions
      if (Math.random() < 0.6) {
        if (distance < nearestDistance) {
          nearestDistance = distance;
          nearestTarget = other;
        }
      }

      // If no preferred target found, target nearest
      if (!nearestTarget && distance < nearestDistance) {
        nearestDistance = distance;
        nearestTarget = other;
      }
    }

    return nearestTarget;
  }

  updateHpDisplay() {
    this.hpDisplay.textContent = this.hp;
  }
}

let zombies = [];
let projectiles = [];

// Add a control panel with spawn buttons
function createZombieControlPanel() {
  // Remove any existing panel first
  const existingPanel = document.querySelector('.zombie-control-panel');
  if (existingPanel) existingPanel.remove();

  const panel = document.createElement('div');
  panel.className = 'zombie-control-panel';

  const archerButton = document.createElement('button');
  archerButton.className = 'spawn-button archer';
  archerButton.textContent = 'Spawn Archer';
  archerButton.addEventListener('click', () => spawnSpecificZombie('archer'));

  const fighterButton = document.createElement('button');
  fighterButton.className = 'spawn-button fighter';
  fighterButton.textContent = 'Spawn Fighter';
  fighterButton.addEventListener('click', () => spawnSpecificZombie('fighter'));

  const tankButton = document.createElement('button');
  tankButton.className = 'spawn-button tank';
  tankButton.textContent = 'Spawn Tank';
  tankButton.addEventListener('click', () => spawnSpecificZombie('tank'));

  const clearButton = document.createElement('button');
  clearButton.className = 'spawn-button clear';
  clearButton.textContent = 'Clear All';
  clearButton.addEventListener('click', clearAllZombies);

  panel.appendChild(archerButton);
  panel.appendChild(fighterButton);
  panel.appendChild(tankButton);
  panel.appendChild(clearButton);

  document.body.appendChild(panel);
}

function spawnSpecificZombie(type) {
  const zombie = new Zombie(type);
  zombies = zombies.filter(z => z.element.isConnected);
  zombies.push(zombie);
  console.log(`${type} zombie spawned`);
}

function clearAllZombies() {
  // Remove all zombies from the DOM
  zombies.forEach(zombie => {
    if (zombie.element && zombie.element.isConnected) {
      zombie.element.remove();
    }
    if (zombie.menu && zombie.menu.isConnected) {
      zombie.menu.remove();
    }
  });

  // Clear projectiles too
  projectiles.forEach(projectile => {
    if (projectile.element && projectile.element.isConnected) {
      projectile.element.remove();
    }
  });

  // Reset arrays
  zombies = [];
  projectiles = [];

  console.log("All zombies cleared");
}

// Message listener for spawning zombies
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log("Message received:", message);

  if (message.action === "spawn_zombie") {
    console.log("Spawning zombie...");
    const types = ['archer', 'fighter', 'tank'];
    const randomType = types[Math.floor(Math.random() * types.length)];
    const zombie = new Zombie(randomType);
    zombies = zombies.filter(z => z.element.isConnected);
    zombies.push(zombie);
    console.log("Zombie spawned:", randomType);

    // Show the control panel when extension is clicked
    createZombieControlPanel();
  }

  return true;
});

// Animation loop
function animate() {
  zombies = zombies.filter(z => z.element.isConnected);

  // Move and update projectiles
  projectiles = projectiles.filter(p => {
    p.move();

    // Check for projectile hits
    for (let zombie of zombies) {
      if (zombie === p.sourceZombie) continue;

      const dx = zombie.x + (zombie.size / 2) - p.x;
      const dy = zombie.y + (zombie.size / 2) - p.y;
      const distance = Math.sqrt(dx * dx + dy * dy);

      // Use a slightly larger hit area for bigger projectiles
      if (distance < (zombie.size / 2) + 10) {
        zombie.lastAttacker = p.sourceZombie;
        zombie.hp -= p.damage;
        zombie.updateHpDisplay();

        if (zombie.hp <= 0) {
          // Gain 20 HP on kill for the source zombie
          if (p.sourceZombie && p.sourceZombie.element && p.sourceZombie.element.isConnected) {
            p.sourceZombie.hp += 20;
            p.sourceZombie.updateHpDisplay();
          }

          if (zombie.isCrowned && p.sourceZombie) {
            p.sourceZombie.crown();
          }
          zombie.element.remove();
        }
        p.element.remove();
        return false;
      }
    }

    // Remove projectiles that go off screen
    if (p.x < -10 || p.x > window.innerWidth + 10 ||
      p.y < -10 || p.y > window.innerHeight + 10) {
      p.element.remove();
      return false;
    }

    return true;
  });

  // Move zombies
  for (let zombie of zombies) {
    zombie.move();
  }

  requestAnimationFrame(animate);
}

animate();

console.log("Content script initialization complete!"); 