// Entry of dist/plugins/quiz.js: a standalone IIFE that registers the quiz plugin on window.MARCO.
import { definePlugin } from '../define';
import { quizPlugin } from './index';

definePlugin(quizPlugin);
