#!/usr/bin/env node
import { Command } from 'commander';
const program = new Command();
program.name('marco').description('MARCO Engine for lecture decks').version('0.0.1');
program.parse();
