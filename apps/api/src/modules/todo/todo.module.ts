import { Module } from '@nestjs/common';
import { GoogleService } from './google.service';
import { TodoController } from './todo.controller';
import { TodoService } from './todo.service';

/** Módulo To Do List: espejo de solo lectura del Google Calendar de cada usuario. */
@Module({
  controllers: [TodoController],
  providers: [TodoService, GoogleService],
})
export class TodoModule {}
