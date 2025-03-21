class Zombie {
  constructor() {
    this.hp = 10;
    this.element = document.createElement('div');
    this.element.className = 'zombie';
    this.element.textContent = this.hp;

    // Random position
    this.x = Math.random() * (window.innerWidth - 50);
    this.y = Math.random() * (window.innerHeight - 50);

    // Random direction
    this.dx = (Math.random() - 0.5) * 5;
    this.dy = (Math.random() - 0.5) * 5;

    this.element.style.left = this.x + 'px';
    this.element.style.top = this.y + 'px';

    document.body.appendChild(this.element);
  }

  move() {
    this.x += this.dx;
    this.y += this.dy;

    // Bounce off walls
    if (this.x <= 0 || this.x >= window.innerWidth - 50) this.dx *= -1;
    if (this.y <= 0 || this.y >= window.innerHeight - 50) this.dy *= -1;

    this.element.style.left = this.x + 'px';
    this.element.style.top = this.y + 'px';
  }

  checkCollision(other) {
    const dx = this.x - other.x;
    const dy = this.y - other.y;
    const distance = Math.sqrt(dx * dx + dy * dy);

    if (distance < 50) { // If zombies collide
      this.hp -= 1;
      other.hp -= 1;

      // Update HP display
      this.element.textContent = this.hp;
      other.element.textContent = other.hp;

      // Reverse directions
      this.dx *= -1;
      this.dy *= -1;
      other.dx *= -1;
      other.dy *= -1;

      // Remove zombies with 0 HP
      if (this.hp <= 0) this.element.remove();
      if (other.hp <= 0) other.element.remove();

      return true;
    }
    return false;
  }
}

let zombies = [];

// Listen for extension icon click
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "spawn_zombie") {
    const zombie = new Zombie();
    zombies = zombies.filter(z => z.element.isConnected); // Clean up dead zombies
    zombies.push(zombie);
  }
});

// Animation loop
function animate() {
  zombies = zombies.filter(z => z.element.isConnected); // Clean up dead zombies

  for (let zombie of zombies) {
    zombie.move();

    // Check collisions with other zombies
    for (let other of zombies) {
      if (zombie !== other) {
        zombie.checkCollision(other);
      }
    }
  }

  requestAnimationFrame(animate);
}

animate(); 