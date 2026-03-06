import { Component, OnInit, OnDestroy } from '@angular/core';
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
  dirX = 1;
  dirY = 0;
  nextDirX = 1;
  nextDirY = 0;
  score = 0;
  gameOver = false;
  rows = Array.from({ length: GRID }, (_, i) => i);
  cols = Array.from({ length: GRID }, (_, i) => i);

  private interval: any;

  ngOnInit() { this.startGame(); }
  ngOnDestroy() { clearInterval(this.interval); }

  startGame() {
    this.snake = [{ x: 10, y: 10 }];
    this.dirX = 1; this.dirY = 0;
    this.nextDirX = 1; this.nextDirY = 0;
    this.score = 0;
    this.gameOver = false;
    this.placeFood();
    clearInterval(this.interval);
    this.interval = setInterval(() => this.tick(), 150);
  }

  tick() {
    this.dirX = this.nextDirX;
    this.dirY = this.nextDirY;

    const head = {
      x: this.snake[0].x + this.dirX,
      y: this.snake[0].y + this.dirY
    };

    if (head.x < 0 || head.x >= GRID || head.y < 0 || head.y >= GRID) {
      this.gameOver = true;
      clearInterval(this.interval);
      return;
    }
    if (this.snake.some(s => s.x === head.x && s.y === head.y)) {
      this.gameOver = true;
      clearInterval(this.interval);
      return;
    }

    this.snake.unshift(head);
    if (head.x === this.food.x && head.y === this.food.y) {
      this.score++;
      this.placeFood();
    } else {
      this.snake.pop();
    }
  }

  placeFood() {
    this.food = {
      x: Math.floor(Math.random() * GRID),
      y: Math.floor(Math.random() * GRID)
    };
  }

  goUp()    { if (this.dirY !== 1)  { this.nextDirX = 0;  this.nextDirY = -1; } }
  goDown()  { if (this.dirY !== -1) { this.nextDirX = 0;  this.nextDirY = 1;  } }
  goLeft()  { if (this.dirX !== 1)  { this.nextDirX = -1; this.nextDirY = 0;  } }
  goRight() { if (this.dirX !== -1) { this.nextDirX = 1;  this.nextDirY = 0;  } }

  isSnake(x: number, y: number) { return this.snake.some(s => s.x === x && s.y === y); }
  isFood(x: number, y: number)  { return this.food.x === x && this.food.y === y; }
}