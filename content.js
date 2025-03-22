console.log("Content script loaded!");

class Projectile {
  constructor(x, y, targetX, targetY, damage, sourceZombie) {
    this.sourceZombie = sourceZombie;
    this.element = document.createElement('div');
    this.element.className = 'projectile';
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

    // Set properties based on type
    switch (type) {
      case 'archer':
        this.hp = 100;
        this.damage = 4;
        this.speed = 3;
        this.cooldown = 1000;
        this.range = 999999; // Effectively infinite range
        break;
      case 'fighter':
        this.hp = 150;
        this.damage = 20;
        this.speed = 5;
        this.cooldown = 700;
        this.range = 50;
        break;
      case 'tank':
        this.hp = 300;
        this.damage = 15;
        this.speed = 2;
        this.cooldown = 1000;
        this.range = 50;
        break;
    }

    this.element = document.createElement('div');
    this.element.className = `zombie ${type}`;
    this.element.textContent = this.hp;

    this.lastAttackTime = 0;
    this.x = Math.random() * (window.innerWidth - 50);
    this.y = Math.random() * (window.innerHeight - 50);
    this.dx = 0;
    this.dy = 0;

    // Add size property
    this.size = 50; // Size in pixels

    this.element.style.left = this.x + 'px';
    this.element.style.top = this.y + 'px';
    document.body.appendChild(this.element);

    this.isCrowned = false;
    this.maxHp = this.hp;
    this.originalDamage = this.damage;
    this.lastAttacker = null;
    this.regenAmount = 10; // Flat regeneration amount

    // Add click listener for crowning
    this.element.addEventListener('click', (e) => {
      e.stopPropagation(); // Prevent event bubbling
      this.crown();
    });
  }

  checkCollision(other) {
    const dx = this.x - other.x;
    const dy = this.y - other.y;
    const distance = Math.sqrt(dx * dx + dy * dy);

    // Use the full size for collision detection
    return distance < this.size;
  }

  findTarget() {
    let nearestTarget = null;
    let nearestDistance = Infinity;

    for (let other of zombies) {
      if (other === this) continue;

      const dx = other.x - this.x;
      const dy = other.y - this.y;
      const distance = Math.sqrt(dx * dx + dy * dy);

      // 60% chance targeting logic
      if (Math.random() < 0.6) {
        if ((this.type === 'archer' && other.type === 'tank') ||
          (this.type === 'fighter' && other.type === 'archer') ||
          (this.type === 'tank' && other.type === 'fighter')) {
          if (distance < nearestDistance) {
            nearestDistance = distance;
            nearestTarget = other;
          }
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

  move() {
    const target = this.findTarget();
    const now = Date.now();

    if (!target) return;

    const dx = target.x - this.x;
    const dy = target.y - this.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    const angle = Math.atan2(dy, dx);

    if (this.type === 'archer') {
      // Archer movement
      if (distance < 200) {
        // Run away if too close
        this.dx = -Math.cos(angle) * this.speed;
        this.dy = -Math.sin(angle) * this.speed;
      }
      // Attack from any distance
      if (now - this.lastAttackTime >= this.cooldown) {
        this.attack(target);
      }
    } else {
      // Fighter and Tank movement
      if (distance > this.range) {
        // Move towards target
        this.dx = Math.cos(angle) * this.speed;
        this.dy = Math.sin(angle) * this.speed;
      }
      // Attack if in range
      if (distance <= this.range && now - this.lastAttackTime >= this.cooldown) {
        this.attack(target);
      }
    }

    // Update position
    this.x += this.dx;
    this.y += this.dy;

    // Keep zombies within screen bounds
    this.x = Math.max(0, Math.min(window.innerWidth - this.size, this.x));
    this.y = Math.max(0, Math.min(window.innerHeight - this.size, this.y));

    this.element.style.left = this.x + 'px';
    this.element.style.top = this.y + 'px';
  }

  attack(target) {
    this.lastAttackTime = Date.now();

    if (this.type === 'archer') {
      const projectile = new Projectile(this.x, this.y, target.x, target.y, this.damage, this);
      projectiles.push(projectile);
    } else {
      // Set this zombie as the last attacker
      target.lastAttacker = this;

      target.hp -= this.damage;
      target.element.textContent = target.hp;

      // Check if target died and was crowned
      if (target.hp <= 0) {
        if (target.isCrowned) {
          this.crown(); // Transfer crown to killer
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

  crown() {
    if (!this.isCrowned) {
      this.isCrowned = true;

      // Increase max HP and current HP by 100
      this.maxHp += 100;
      this.hp += 100;

      // Increase damage by 20%
      this.damage = Math.floor(this.originalDamage * 1.2);

      // Update HP display
      this.element.textContent = this.hp;

      // Add crown visual and crowned class
      this.element.classList.add('crowned');
      const crown = document.createElement('div');
      crown.className = 'crown';
      crown.innerHTML = '👑';
      this.element.appendChild(crown);

      // Add crown get effect
      this.crownGetEffect();

      // Start health regeneration
      this.startRegeneration();
    }
  }

  crownGetEffect() {
    // Create a burst effect when getting crown
    const burst = document.createElement('div');
    burst.className = 'crown-burst';
    this.element.appendChild(burst);

    // Remove burst effect after animation
    setTimeout(() => burst.remove(), 1000);
  }

  startRegeneration() {
    const regenInterval = setInterval(() => {
      if (this.element.isConnected && this.isCrowned && this.hp < this.maxHp) {
        // Regenerate flat 10 HP instead of percentage
        this.hp = Math.min(this.maxHp, this.hp + this.regenAmount);
        this.element.textContent = this.hp;

        // Re-add the crown after updating text content
        if (this.isCrowned) {
          const crown = document.createElement('div');
          crown.className = 'crown';
          crown.innerHTML = '👑';
          this.element.appendChild(crown);
        }
      } else if (!this.element.isConnected) {
        clearInterval(regenInterval);
      }
    }, 1000);
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
}

let zombies = [];
let projectiles = [];

// Message listener for spawning zombies
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log("Message received:", message); // Debug log
  if (message.action === "spawn_zombie") {
    console.log("Spawning zombie..."); // Debug log
    const types = ['archer', 'fighter', 'tank'];
    const randomType = types[Math.floor(Math.random() * types.length)];
    const zombie = new Zombie(randomType);
    zombies = zombies.filter(z => z.element.isConnected);
    zombies.push(zombie);
    console.log("Zombie spawned:", randomType); // Debug log
  }
  return true; // Important: indicates we will respond asynchronously
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

      if (distance < zombie.size / 2) {
        zombie.lastAttacker = p.sourceZombie;
        zombie.hp -= p.damage;
        zombie.element.textContent = zombie.hp;

        if (zombie.hp <= 0) {
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