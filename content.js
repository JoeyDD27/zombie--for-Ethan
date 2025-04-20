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

    // Store target info for potential damage calculation later
    this.targetType = null;

    // Calculate direction
    const angle = Math.atan2(targetY - y, targetX - x);
    this.dx = Math.cos(angle) * 10;
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

    // Set properties based on type
    switch (type) {
      case 'archer':
        this.hp = 300;
        this.damage = 15;
        this.speed = 3.8;
        this.cooldown = 400;
        this.range = 400;
        this.fleeThreshold = 150;
        this.tankDamageMultiplier = 2.0;
        break;
      case 'fighter':
        this.hp = 500;
        this.damage = 22;
        this.speed = 8;
        this.cooldown = 800;
        this.range = 50;
        this.archerDamageMultiplier = 1.5;
        break;
      case 'tank':
        this.hp = 800;
        this.damage = 20;
        this.speed = 5.5;
        this.cooldown = 800;
        this.range = 60;
        break;
    }

    // Target memory and AI settings
    this.currentTarget = null;
    this.targetSwitchCooldown = 0;
    this.targetMemoryTime = 3000;
    this.personalSpace = this.size * 1.2;
    this.fleeHealthPercentage = 30;
    this.lastFleeTime = 0;
    this.fleeTime = 2000;

    // Alliance system
    this.allianceId = Math.random().toString(36).substr(2, 9); // Unique alliance ID
    this.alliedWith = new Set(); // Set of zombie IDs in the same alliance
    this.lastAllianceCheck = 0;
    this.allianceCheckInterval = 2000; // Check alliances every 2 seconds
    this.betrayalChance = 0.1; // 10% chance to betray alliance when only one exists

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
        this.damage += 15;
        this.healAmount = 15;
        break;
      case 'fighter':
        this.speed = 14;
        this.damage = 35;
        this.healAmount = 20;
        this.aoeDamageInterval = 500;
        this.aoeRadius = 175;
        this.aoeDamage = 35;
        break;
      case 'tank':
        this.hp += 1000;
        this.damage += 100;
        this.healAmount = 25;
        this.speed += 1.5;
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

    this.hp += 250;
    this.damage = Math.floor(this.damage * 1.2);
    this.healAmount = 15; // Increased from 5
    this.updateHpDisplay();
    this.hideMenu();
  }

  move() {
    const now = Date.now();

    // Add healing for crowned and OP zombies
    if ((this.isCrowned || this.isOP) && now - this.lastHealTime >= this.healInterval) {
      this.lastHealTime = now;
      this.hp += this.healAmount;
      this.updateHpDisplay();
    }

    // Find a target if we don't have one
    const target = this.findTarget();
    if (!target) return;

    // Calculate basic direction toward target
    const dx = target.x - this.x;
    const dy = target.y - this.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    let moveAngle = Math.atan2(dy, dx);

    // Calculate movement direction and priority
    let shouldFlee = false;
    let shouldMaintainDistance = false;
    let shouldAvoidClustering = false;
    let finalSpeed = this.speed;

    // PRIORITY 1: Flee if health is low or recently attacked
    const healthPercentage = (this.hp / (this.type === 'archer' ? 300 : this.type === 'fighter' ? 500 : 800)) * 100;
    if (healthPercentage < this.fleeHealthPercentage || now - this.lastFleeTime < this.fleeTime) {
      shouldFlee = true;
      this.lastFleeTime = now;

      // Flee in the opposite direction of the target
      moveAngle += Math.PI;
      finalSpeed = this.speed * 1.3; // Faster when fleeing
    }

    // PRIORITY 2: Archers maintain optimal distance
    if (!shouldFlee && this.type === 'archer') {
      if (distance < 200) {
        shouldMaintainDistance = true;
        // Move away but at an angle to circle around
        const circleAngle = Math.PI / 4; // 45 degrees
        moveAngle += Math.PI + (Math.random() > 0.5 ? circleAngle : -circleAngle);
      } else if (distance > 350) {
        // Get closer but cautiously
        finalSpeed = this.speed * 0.8;
      } else {
        // At good range - strafe sideways occasionally
        if (Math.random() < 0.1) {
          moveAngle += Math.PI / 2 * (Math.random() > 0.5 ? 1 : -1);
          finalSpeed = this.speed * 0.6;
        }
      }
    }

    // PRIORITY 3: Avoid clustering with same type zombies
    if (!shouldFlee && !shouldMaintainDistance) {
      const sameTypeZombies = zombies.filter(z => z !== this && z.type === this.type);
      let avoidanceVector = { x: 0, y: 0 };

      for (const other of sameTypeZombies) {
        const otherDx = other.x - this.x;
        const otherDy = other.y - this.y;
        const otherDist = Math.sqrt(otherDx * otherDx + otherDy * otherDy);

        // If too close to same type zombie
        if (otherDist < this.personalSpace) {
          shouldAvoidClustering = true;
          // Add repulsion vector (stronger when closer)
          const repulsionStrength = 1 - (otherDist / this.personalSpace);
          avoidanceVector.x -= otherDx * repulsionStrength;
          avoidanceVector.y -= otherDy * repulsionStrength;
        }
      }

      if (shouldAvoidClustering) {
        // Blend the avoidance direction with the target direction
        const avoidanceAngle = Math.atan2(avoidanceVector.y, avoidanceVector.x);
        moveAngle = moveAngle * 0.7 + avoidanceAngle * 0.3;
      }
    }

    // PRIORITY 4: Standard movement behavior
    if (!shouldFlee && !shouldMaintainDistance && !shouldAvoidClustering) {
      // Melee units (fighter and tank) approach directly when target is beyond attack range
      if ((this.type === 'fighter' || this.type === 'tank') && distance > this.range) {
        // Standard approach
        finalSpeed = this.speed;
      } else if ((this.type === 'fighter' || this.type === 'tank') && distance <= this.range) {
        // If in range, slow down to stay in range
        finalSpeed = this.speed * 0.3;
      }
    }

    // Apply final movement
    this.x += Math.cos(moveAngle) * finalSpeed;
    this.y += Math.sin(moveAngle) * finalSpeed;

    // Keep zombies within screen bounds
    this.x = Math.max(0, Math.min(window.innerWidth - this.size, this.x));
    this.y = Math.max(0, Math.min(window.innerHeight - this.size, this.y));

    this.element.style.left = this.x + 'px';
    this.element.style.top = this.y + 'px';

    // Attack if in range and not fleeing
    if (!shouldFlee && distance <= this.range && now - this.lastAttackTime >= this.cooldown) {
      this.attack(target);
    }

    // Add AOE damage for OP fighters
    if (this.isOP && this.type === 'fighter' && now - this.lastAoeDamageTime >= this.aoeDamageInterval) {
      this.lastAoeDamageTime = now;
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
      let damageDealt = this.damage;

      // Apply fighter's bonus damage against archers
      if (this.type === 'fighter' && target.type === 'archer' && this.archerDamageMultiplier) {
        damageDealt = Math.floor(damageDealt * this.archerDamageMultiplier);
      }

      target.hp -= damageDealt;
      target.updateHpDisplay();

      if (target.hp <= 0) {
        // Gain 50 HP on kill (increased from 20)
        this.hp += 50;
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
    const now = Date.now();

    // If we already have a target and it's still valid, stick with it
    if (this.currentTarget &&
      this.currentTarget.element &&
      this.currentTarget.element.isConnected &&
      now - this.targetSwitchCooldown < this.targetMemoryTime) {
      return this.currentTarget;
    }

    // Reset the target switch cooldown
    this.targetSwitchCooldown = now;

    let bestTarget = null;
    let bestScore = -1;

    // Find all potential targets
    for (let other of zombies) {
      if (other === this || !other.element.isConnected) continue;

      const dx = other.x - this.x;
      const dy = other.y - this.y;
      const distance = Math.sqrt(dx * dx + dy * dy);

      // Base score starts with proximity (closer is better, but not too close)
      // Using inverse of distance so closer targets have higher scores
      let score = 1000 / (distance + 1);

      // Adjust score based on target type advantages
      if (this.type === 'archer' && other.type === 'tank') {
        score *= 3; // Archers strongly prefer targeting tanks
      } else if (this.type === 'fighter' && other.type === 'archer') {
        score *= 3; // Fighters strongly prefer targeting archers
      } else if (this.type === 'tank' && other.type === 'fighter') {
        score *= 2; // Tanks moderately prefer targeting fighters
      }

      // Adjust score based on target health - prefer damaged targets
      score *= (1 + (1 - other.hp / 800)); // Assuming 800 is max health any zombie can have

      // Prefer targeting OP or crowned zombies
      if (other.isOP) score *= 2;
      if (other.isCrowned) score *= 2.5;

      // Team up on the same target as nearby allies
      const alliesTargetingThis = zombies.filter(z =>
        z !== this &&
        z.type === this.type &&
        z.currentTarget === other
      ).length;

      // If allies are already targeting this enemy, join them (but not too many)
      if (alliesTargetingThis > 0 && alliesTargetingThis < 3) {
        score *= 1.5;
      } else if (alliesTargetingThis >= 3) {
        // Too many allies already targeting this enemy, reduce score
        score *= 0.5;
      }

      // If this target is significantly stronger than us, be more cautious
      if (other.hp > this.hp * 1.5) {
        const alliesNearby = zombies.filter(z =>
          z !== this &&
          z.type === this.type &&
          Math.sqrt(Math.pow(z.x - this.x, 2) + Math.pow(z.y - this.y, 2)) < 150
        ).length;

        // Only engage strong enemies if we have allies nearby
        if (alliesNearby < 2) {
          score *= 0.3;
        }
      }

      if (score > bestScore) {
        bestScore = score;
        bestTarget = other;
      }
    }

    this.currentTarget = bestTarget;
    return bestTarget;
  }

  updateHpDisplay() {
    this.hpDisplay.textContent = this.hp;
  }

  // Helper method to check if the archer is against walls/edges
  checkForWalls() {
    const walls = [];
    const padding = 50; // How close to edge to consider "at wall"

    if (this.x < padding) walls.push('left');
    if (this.x > window.innerWidth - this.size - padding) walls.push('right');
    if (this.y < padding) walls.push('top');
    if (this.y > window.innerHeight - this.size - padding) walls.push('bottom');

    return walls;
  }
}

let zombies = [];
let projectiles = [];

// Alliance tracking system
const alliances = [];

class Alliance {
  constructor(type) {
    this.id = Math.random().toString(36).substr(2, 9);
    this.type = type;
    this.members = new Set();
    this.color = this.generateColor();
  }

  generateColor() {
    // Generate a visible color based on zombie type but with some variation
    let baseColor;
    switch (this.type) {
      case 'archer':
        baseColor = [76, 175, 80]; // Green base
        break;
      case 'fighter':
        baseColor = [244, 67, 54]; // Red base
        break;
      case 'tank':
        baseColor = [33, 150, 243]; // Blue base
        break;
      default:
        baseColor = [100, 100, 100];
    }

    // Add some random variation
    const variation = 30;
    const r = Math.max(0, Math.min(255, baseColor[0] + (Math.random() * variation * 2 - variation)));
    const g = Math.max(0, Math.min(255, baseColor[1] + (Math.random() * variation * 2 - variation)));
    const b = Math.max(0, Math.min(255, baseColor[2] + (Math.random() * variation * 2 - variation)));

    return `rgb(${Math.floor(r)}, ${Math.floor(g)}, ${Math.floor(b)})`;
  }

  addMember(zombie) {
    this.members.add(zombie.allianceId);
    zombie.allianceId = this.id;
    zombie.alliance = this;
    zombie.element.style.borderColor = this.color;
  }

  removeMember(zombie) {
    this.members.delete(zombie.allianceId);
    if (this.members.size === 0) {
      // Remove alliance if empty
      const index = alliances.findIndex(a => a.id === this.id);
      if (index !== -1) {
        alliances.splice(index, 1);
      }
    }
  }

  get size() {
    return this.members.size;
  }
}

// Add alliance management methods to Zombie prototype
Zombie.prototype.updateAlliances = function () {
  const now = Date.now();
  if (now - this.lastAllianceCheck < this.allianceCheckInterval) return;
  this.lastAllianceCheck = now;

  // Check for nearby same-type zombies to form alliances with
  const nearbyAllies = zombies.filter(z =>
    z !== this &&
    z.type === this.type &&
    Math.sqrt(Math.pow(z.x - this.x, 2) + Math.pow(z.y - this.y, 2)) < 200
  );

  if (nearbyAllies.length > 0) {
    // Try to join an existing alliance
    let joinedAlliance = false;

    for (const ally of nearbyAllies) {
      if (ally.alliance) {
        if (!this.alliance) {
          // Join ally's alliance
          ally.alliance.addMember(this);
          joinedAlliance = true;
          break;
        } else if (this.alliance.id !== ally.alliance.id) {
          // Merge alliances
          for (const memberId of this.alliance.members) {
            const member = zombies.find(z => z.allianceId === memberId);
            if (member) {
              ally.alliance.addMember(member);
            }
          }
          joinedAlliance = true;
          break;
        }
      }
    }

    // Create new alliance if didn't join one
    if (!joinedAlliance && !this.alliance) {
      const newAlliance = new Alliance(this.type);
      alliances.push(newAlliance);
      newAlliance.addMember(this);

      // Add nearby allies to the new alliance
      for (const ally of nearbyAllies) {
        if (!ally.alliance) {
          newAlliance.addMember(ally);
        }
      }
    }
  }

  // Check if only one big alliance remains and consider betrayal
  if (alliances.length === 1 && alliances[0].size > 5) {
    if (Math.random() < this.betrayalChance) {
      this.betrayAlliance();
    }
  }
};

Zombie.prototype.betrayAlliance = function () {
  if (this.alliance) {
    console.log(`Zombie ${this.allianceId} is betraying their alliance!`);

    // Leave current alliance
    this.alliance.removeMember(this);
    this.alliance = null;

    // Create new alliance with a different color
    const newAlliance = new Alliance(this.type);
    alliances.push(newAlliance);
    newAlliance.addMember(this);

    // Make this zombie hostile to former allies
    this.betrayal = true;

    // Visual indication of betrayal
    this.element.style.borderWidth = '3px';
    this.element.style.borderStyle = 'dashed';

    // Temporarily boost this zombie for the betrayal
    this.damage *= 1.5;
    this.speed *= 1.2;
    this.hp += 100;
    this.updateHpDisplay();

    // Reset after 15 seconds
    setTimeout(() => {
      if (this.element && this.element.isConnected) {
        this.betrayal = false;
        this.damage /= 1.5;
        this.speed /= 1.2;
        this.element.style.borderWidth = '2px';
        this.element.style.borderStyle = 'solid';
      }
    }, 15000);
  }
};

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

        // Calculate damage with type advantages
        let damageDealt = p.damage;

        // Apply archer's bonus damage against tanks
        if (p.sourceZombie && p.sourceZombie.type === 'archer' &&
          zombie.type === 'tank' && p.sourceZombie.tankDamageMultiplier) {
          damageDealt = Math.floor(damageDealt * p.sourceZombie.tankDamageMultiplier);
        }

        zombie.hp -= damageDealt;
        zombie.updateHpDisplay();

        if (zombie.hp <= 0) {
          // Gain 50 HP on kill for the source zombie
          if (p.sourceZombie && p.sourceZombie.element && p.sourceZombie.element.isConnected) {
            p.sourceZombie.hp += 50;
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