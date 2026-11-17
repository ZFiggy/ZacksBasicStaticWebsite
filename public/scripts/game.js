class Game {
    constructor() {
        this.canvas = document.getElementById('gameCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.score = 0;

        // Define the shapes (example rectangles here)
        this.shapes = [
            { x: 50, y: 50, width: 50, height: 50, name: 'Main' },
            { x: 150, y: 150, width: 50, height: 50, name: 'collectable' },
            { x: 250, y: 250, width: 50, height: 50, name: 'collectable' }
        ];

        // Start game loop
        this.update();

        // Handle keyboard input
        document.addEventListener('keydown', (e) => this.handleInput(e));
    }

    redraw() {
        // Clear the canvas
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        // Draw each shape
        for (const shape of this.shapes) {
            this.ctx.fillRect(shape.x, shape.y, shape.width, shape.height);
        }
    }

    handleInput(e) {
        if (this.shapes.length === 1) return;

        const player = this.shapes[0];
        switch (e.key) {
            case 'ArrowRight': player.x += 10; break;
            case 'ArrowDown': player.y += 10; break;
            default: return;
        }
        e.preventDefault();
        player.x = Math.max(0, Math.min(player.x, this.canvas.width - player.width));
        player.y = Math.max(0, Math.min(player.y, this.canvas.height - player.height));
    }

    checkCollision(obj1, obj2) {
        // Check if the two objects are colliding
        return obj1.x < obj2.x + obj2.width &&
               obj1.x + obj1.width > obj2.x &&
               obj1.y < obj2.y + obj2.height &&
               obj1.y + obj1.height > obj2.y;
    }

    update() {
        // Iterate backwards so removing one collectible does not skip another.
        for (let i = this.shapes.length - 1; i >= 1; i--) {
            if (this.checkCollision(this.shapes[0], this.shapes[i])) {
                this.score++;
                this.shapes.splice(i, 1);
            }
        }
        this.redraw();

        // Stop scheduling frames once both collectibles have been eaten.
        if (this.shapes.length > 1) {
            requestAnimationFrame(() => this.update());
        }
    }
}

// Initialize the game
document.myGame = new Game();
