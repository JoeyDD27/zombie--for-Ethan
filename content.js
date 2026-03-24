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
        this.hp = 125;
        this.damage = 10;
        this.speed = 3;
        this.cooldown = 1100;
        this.range = 999999; // Effectively infinite range
        break;
      case 'fighter':
        this.hp = 75;
        this.damage = 25;
        this.speed = 4;
        this.cooldown = 700;
        this.range = 150;
        break;
      case 'tank':
        this.hp = 350;
        this.damage = 30;
        this.speed = 2;
        this.cooldown = 1000;
        this.range = 60;
        break;
    }

    this.element = document.createElement('div');
    this.element.className = `zombie ${type}`;

    // Use a separate span for HP so updating it doesn't destroy child elements (like the crown)
    this.hpDisplay = document.createElement('span');
    this.hpDisplay.className = 'hp-display';
    this.hpDisplay.textContent = this.hp;
    this.element.appendChild(this.hpDisplay);

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
    this.lastDamagedTime = 0; // Track when last took damage for passive healing

    // Add click listener for crowning
    this.element.addEventListener('click', (e) => {
      e.stopPropagation(); // Prevent event bubbling
      this.crown();
    });
  }

  findTarget() {
    // If we already have a valid cached target, keep it (re-evaluate every 30 frames)
    if (this._cachedTarget && this._cachedTarget.element.isConnected &&
      this._cachedTarget.hp > 0 && this._targetTimer > 0) {
      this._targetTimer--;
      return this._cachedTarget;
    }

    let nearestTarget = null;
    let nearestDistance = Infinity;
    const hpPercent = this.hp / this.maxHp;
    const isLowHp = hpPercent < 0.4;

    // Fighters only care about targets within a reasonable chase distance
    const maxSearchRange = this.type === 'fighter' ? 400 : Infinity;

    const myCx = this.x + this.size / 2;
    const myCy = this.y + this.size / 2;

    for (let other of zombies) {
      if (other === this || !other.element.isConnected) continue;

      const dx = (other.x + other.size / 2) - myCx;
      const dy = (other.y + other.size / 2) - myCy;
      const distance = Math.sqrt(dx * dx + dy * dy);

      // Ignore targets that are too far away
      if (distance > maxSearchRange) continue;

      // When low HP and multiple enemies exist, skip enemies that have way more HP
      if (isLowHp && other.hp > this.hp * 2 && zombies.filter(z => z !== this && z.element.isConnected).length > 1) continue;

      if (distance < nearestDistance) {
        nearestDistance = distance;
        nearestTarget = other;
      }
    }

    // If fighter found nothing in range, fall back to absolute nearest
    if (!nearestTarget && this.type === 'fighter') {
      for (let other of zombies) {
        if (other === this || !other.element.isConnected) continue;
        const dx = (other.x + other.size / 2) - myCx;
        const dy = (other.y + other.size / 2) - myCy;
        const distance = Math.sqrt(dx * dx + dy * dy);
        if (distance < nearestDistance) {
          nearestDistance = distance;
          nearestTarget = other;
        }
      }
    }

    this._cachedTarget = nearestTarget;
    this._targetTimer = 30;
    return nearestTarget;
  }

  // Check if any enemy is actively targeting/attacking this fighter
  isBeingTargeted() {
    const myCx = this.x + this.size / 2;
    const myCy = this.y + this.size / 2;
    for (let other of zombies) {
      if (other === this || !other.element.isConnected) continue;
      if (other._cachedTarget === this) {
        const dx = (other.x + other.size / 2) - myCx;
        const dy = (other.y + other.size / 2) - myCy;
        const distance = Math.sqrt(dx * dx + dy * dy);
        // Only panic if the attacker is close enough to be a threat
        if (distance < 150) return other;
      }
    }
    return null;
  }

  move() {
    const target = this.findTarget();
    const now = Date.now();

    // Passive healing: if not hit for 3 seconds, heal slowly
    if (now - this.lastDamagedTime > 3000 && this.hp < this.maxHp) {
      // Heal ~2% max HP per frame tick (~5 HP/sec at 60fps → actually per-call)
      if (!this._lastHealTick || now - this._lastHealTick > 500) {
        this.hp = Math.min(this.maxHp, this.hp + Math.ceil(this.maxHp * 0.03));
        this.hpDisplay.textContent = this.hp;
        this._lastHealTick = now;
      }
    }

    if (!target) return;

    const myCx = this.x + this.size / 2;
    const myCy = this.y + this.size / 2;
    const tCx = target.x + target.size / 2;
    const tCy = target.y + target.size / 2;
    const dx = tCx - myCx;
    const dy = tCy - myCy;
    const distance = Math.sqrt(dx * dx + dy * dy);
    const angle = Math.atan2(dy, dx);

    // === Survival instinct ===
    const hpPercent = this.hp / this.maxHp;
    // Count how many other zombies are alive (not counting us or our target)
    const othersAlive = zombies.filter(z => z !== this && z !== target && z.element.isConnected).length;
    // Only flee if we'd lose AND there's someone else to fight (not a 1v1)
    const wouldLose = hpPercent < 0.4 && target.hp > this.hp * 1.5 && othersAlive > 0;
    const threatener = this.isBeingTargeted();

    // Track stall/heal attempt — if fleeing isn't working, rush in
    if (wouldLose && !this._stallGaveUp) {
      if (!this._stallStartTime) {
        // Start stalling — remember when and how much HP we had
        this._stallStartTime = now;
        this._stallStartHp = this.hp;
      } else if (now - this._stallStartTime > 2000) {
        // Been stalling for 2 seconds — check if healing worked
        if (this.hp <= this._stallStartHp) {
          // Still losing HP or not healing — give up stalling, rush in
          this._stallGaveUp = true;
        }
        // Reset to re-evaluate
        this._stallStartTime = now;
        this._stallStartHp = this.hp;
      }

      // Still trying to stall — flee
      this.dx = -Math.cos(angle) * this.speed * 1.3;
      this.dy = -Math.sin(angle) * this.speed * 1.3;
      this._targetTimer = 0;
    } else if (this._stallGaveUp) {
      // Stalling failed — all-in rush, fight to the death
      if (distance > this.range) {
        this.dx = Math.cos(angle) * this.speed * 1.3;
        this.dy = Math.sin(angle) * this.speed * 1.3;
      } else {
        this.dx = 0;
        this.dy = 0;
      }
      if (distance <= this.range && now - this.lastAttackTime >= this.cooldown) {
        this.attack(target);
      }
      // Reset gave-up if HP recovers above threshold
      if (hpPercent >= 0.4) {
        this._stallGaveUp = false;
        this._stallStartTime = null;
      }
    } else if (threatener && threatener !== target) {
      // Not fleeing from target — reset stall tracking
      this._stallStartTime = null;
      this._stallStartHp = null;
      this._stallGaveUp = false;
      // Being targeted by someone we're not fighting — flee from them
      const threatDx = (threatener.x + threatener.size / 2) - myCx;
      const threatDy = (threatener.y + threatener.size / 2) - myCy;
      const threatAngle = Math.atan2(threatDy, threatDx);
      this.dx = -Math.cos(threatAngle) * this.speed * 1.2;
      this.dy = -Math.sin(threatAngle) * this.speed * 1.2;
      // Still attack own target if in range while fleeing
      if (this.type === 'archer') {
        if (now - this.lastAttackTime >= this.cooldown) this.attack(target);
      } else if (distance <= this.range && now - this.lastAttackTime >= this.cooldown) {
        this.attack(target);
      }
    } else if (this.type === 'archer') {
      // Archer: kite away from close enemies, shoot from any distance
      if (distance < 200) {
        this.dx = -Math.cos(angle) * this.speed;
        this.dy = -Math.sin(angle) * this.speed;
      } else {
        this.dx = 0;
        this.dy = 0;
      }
      if (now - this.lastAttackTime >= this.cooldown) {
        this.attack(target);
      }
    } else if (this.type === 'fighter') {
      // Fighter: kite at max sword range
      const sweetSpot = this.range * 0.85;
      if (distance > this.range) {
        this.dx = Math.cos(angle) * this.speed;
        this.dy = Math.sin(angle) * this.speed;
      } else if (distance < sweetSpot - 15) {
        this.dx = -Math.cos(angle) * this.speed * 0.8;
        this.dy = -Math.sin(angle) * this.speed * 0.8;
      } else {
        this.dx = 0;
        this.dy = 0;
      }
      if (distance <= this.range && now - this.lastAttackTime >= this.cooldown) {
        this.attack(target);
      }
    } else {
      // Tank: charge in
      if (distance > this.range) {
        this.dx = Math.cos(angle) * this.speed;
        this.dy = Math.sin(angle) * this.speed;
      } else {
        this.dx = 0;
        this.dy = 0;
      }
      if (distance <= this.range && now - this.lastAttackTime >= this.cooldown) {
        this.attack(target);
      }
    }

    // Separation force — push away from nearby zombies to prevent stacking
    let sepX = 0;
    let sepY = 0;
    for (let other of zombies) {
      if (other === this) continue;
      const sdx = myCx - (other.x + other.size / 2);
      const sdy = myCy - (other.y + other.size / 2);
      const sDist = Math.sqrt(sdx * sdx + sdy * sdy);
      if (sDist < 60 && sDist > 0) {
        // Stronger push the closer they are
        const force = (60 - sDist) / 60 * 2;
        sepX += (sdx / sDist) * force;
        sepY += (sdy / sDist) * force;
      }
    }
    this.dx += sepX;
    this.dy += sepY;

    // Push away from edges/corners so zombies don't get trapped
    const edgeMargin = 60;
    const edgeForce = 3;
    if (this.x < edgeMargin) this.dx += (edgeMargin - this.x) / edgeMargin * edgeForce;
    if (this.x > window.innerWidth - this.size - edgeMargin) this.dx -= (this.x - (window.innerWidth - this.size - edgeMargin)) / edgeMargin * edgeForce;
    if (this.y < edgeMargin) this.dy += (edgeMargin - this.y) / edgeMargin * edgeForce;
    if (this.y > window.innerHeight - this.size - edgeMargin) this.dy -= (this.y - (window.innerHeight - this.size - edgeMargin)) / edgeMargin * edgeForce;

    // Update position
    this.x += this.dx;
    this.y += this.dy;

    // Hard clamp to screen bounds
    this.x = Math.max(0, Math.min(window.innerWidth - this.size, this.x));
    this.y = Math.max(0, Math.min(window.innerHeight - this.size, this.y));

    this.element.style.left = this.x + 'px';
    this.element.style.top = this.y + 'px';
  }

  attack(target) {
    this.lastAttackTime = Date.now();

    if (this.type === 'archer') {
      const cx = this.x + this.size / 2;
      const cy = this.y + this.size / 2;
      const tx = target.x + target.size / 2;
      const ty = target.y + target.size / 2;
      const projectile = new Projectile(cx, cy, tx, ty, this.damage, this);
      projectiles.push(projectile);
    } else {
      // Set this zombie as the last attacker
      target.lastAttacker = this;

      // Spawn attack visual
      if (this.type === 'fighter') {
        this.spawnSwordSwipe(target);
      } else if (this.type === 'tank') {
        this.spawnFistPunch(target);
      }

      target.hp -= this.damage;
      target.lastDamagedTime = Date.now();
      target.hpDisplay.textContent = target.hp;

      // Tank lifesteal: heal 10% of damage dealt
      if (this.type === 'tank') {
        this.hp = Math.min(this.maxHp, this.hp + Math.ceil(this.damage * 0.1));
        this.hpDisplay.textContent = this.hp;
      }

      // Check if target died
      if (target.hp <= 0) {
        if (target.isCrowned) {
          this.crown(); // Transfer crown to killer
        }
        // Fighter heals 40 HP on kill (can exceed max HP)
        if (this.type === 'fighter') {
          this.hp += 40;
          this.hpDisplay.textContent = this.hp;
        }
        killZombie(target);
      }
    }
  }

  spawnSwordSwipe(target) {
    const swipe = document.createElement('div');
    swipe.className = 'sword-swipe';
    // Scale sword length to match attack range
    const swordLen = this.range - this.size / 2;
    // Anchor at the fighter's center
    const cx = this.x + this.size / 2;
    const cy = this.y + this.size / 2;
    const tx = target.x + target.size / 2;
    const ty = target.y + target.size / 2;
    const baseAngle = Math.atan2(ty - cy, tx - cx);
    // Start angle: 60 degrees before the target direction
    const startDeg = (baseAngle * 180 / Math.PI) - 60 + 90; // +90 because stick is vertical
    swipe.style.height = swordLen + 'px';
    swipe.style.left = (cx - 2) + 'px';
    swipe.style.top = (cy - swordLen) + 'px';
    swipe.style.transformOrigin = '2px ' + swordLen + 'px'; // Pivot at the bottom (fighter's center)
    swipe.style.transform = 'rotate(' + startDeg + 'deg)';
    document.body.appendChild(swipe);

    // Animate: rotate 120 degrees over 300ms
    requestAnimationFrame(() => {
      swipe.style.transition = 'transform 0.3s ease-out';
      swipe.style.transform = 'rotate(' + (startDeg + 120) + 'deg)';
    });
    setTimeout(() => swipe.remove(), 300);
  }

  spawnFistPunch(target) {
    const cx = this.x + this.size / 2;
    const cy = this.y + this.size / 2;
    const tx = target.x + target.size / 2;
    const ty = target.y + target.size / 2;
    const angle = Math.atan2(ty - cy, tx - cx);
    // Two fists side by side, right at the edge of the tank
    const punchDist = this.size / 2 + 2; // Just past the tank's edge
    const spread = 8; // Distance between the two fists
    const perpX = -Math.sin(angle) * spread;
    const perpY = Math.cos(angle) * spread;
    const baseX = cx + Math.cos(angle) * punchDist;
    const baseY = cy + Math.sin(angle) * punchDist;

    for (let side = -1; side <= 1; side += 2) {
      const fist = document.createElement('div');
      fist.className = 'fist-punch';
      const fx = baseX + perpX * side * 0.5 - 5;
      const fy = baseY + perpY * side * 0.5 - 5;
      fist.style.left = fx + 'px';
      fist.style.top = fy + 'px';
      document.body.appendChild(fist);

      // Small forward jab animation
      const jabX = Math.cos(angle) * 6;
      const jabY = Math.sin(angle) * 6;
      requestAnimationFrame(() => {
        fist.style.transition = 'left 0.1s ease-out, top 0.1s ease-out';
        fist.style.left = (fx + jabX) + 'px';
        fist.style.top = (fy + jabY) + 'px';
      });
      setTimeout(() => fist.remove(), 200);
    }
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
      this.hpDisplay.textContent = this.hp;

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
        this.hpDisplay.textContent = this.hp;
      } else if (!this.element.isConnected) {
        clearInterval(regenInterval);
      }
    }, 1000);
  }

}

let zombies = [];
let projectiles = [];

function killZombie(zombie) {
  zombie.element.remove();
  const idx = zombies.indexOf(zombie);
  if (idx !== -1) zombies.splice(idx, 1);
}

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
        zombie.lastDamagedTime = Date.now();
        zombie.hpDisplay.textContent = zombie.hp;

        if (zombie.hp <= 0) {
          if (zombie.isCrowned && p.sourceZombie) {
            p.sourceZombie.crown();
          }
          killZombie(zombie);
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