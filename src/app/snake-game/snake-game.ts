import { Component, OnInit, OnDestroy, HostListener } from '@angular/core';
import { NgFor, NgIf } from '@angular/common';

const GRID = 20;

@Component({
  selector: 'app-snake-game',
  imports: [NgFor, NgIf],
  templateUrl: './snake-game.html',
  styleUrl: './snake-game.css',
})
export class SnakeGame implements OnInit, OnDestroy {
  snake = [{ x: 10, y: 10 }];
  food = { x: 5, y: 5 };
  dir = { x: 1, y: 0 };
  score = 0;
  gameOver = false;
  cells = Array.from({ length: GRID * GRID }, (_, i) => ({
    x: i % GRID,
    y: Math.floor(i / GRID)
  }));

  private interval: any;

  ngOnInit() { this.startGame(); }
  ngOnDestroy() { clearInterval(this.interval); }

  startGame() {
    this.snake = [{ x: 10, y: 10 }];
    this.dir = { x: 1, y: 0 };
    this.score = 0;
    this.gameOver = false;
    this.placeFood();
    clearInterval(this.interval);
    this.interval = setInterval(() => this.tick(), 150);
  }

  tick() {
    const head = { x: this.snake[0].x + this.dir.x, y: this.snake[0].y + this.dir.y };

    if (head.x < 0 || head.x >= GRID || head.y < 0 || head.y >= GRID) return this.endGame();
    if (this.snake.some(s => s.x === head.x && s.y === head.y)) return this.endGame();

    this.snake.unshift(head);
    if (head.x === this.food.x && head.y === this.food.y) {
      this.score++;
      this.placeFood();
    } else {
      this.snake.pop();
    }
  }

  placeFood() {
    this.food = { x: Math.floor(Math.random() * GRID), y: Math.floor(Math.random() * GRID) };
  }

  endGame() { this.gameOver = true; clearInterval(this.interval); }

  @HostListener('window:keydown', ['$event'])
  onKey(e: KeyboardEvent) {
    const map: Record<string, { x: number, y: number }> = {
      ArrowUp:    { x: 0,  y: -1 },
      ArrowDown:  { x: 0,  y:  1 },
      ArrowLeft:  { x: -1, y:  0 },
      ArrowRight: { x: 1,  y:  0 }
    };
    const next = map[e.key];
    if (next && !(next.x === -this.dir.x && next.y === -this.dir.y)) this.dir = next;
  }

  isSnake(x: number, y: number) { return this.snake.some(s => s.x === x && s.y === y); }
  isFood(x: number, y: number)  { return this.food.x === x && this.food.y === y; }
}