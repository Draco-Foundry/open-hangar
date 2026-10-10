// The basic page (the connector build; src/basic.html). Mounted alone: it loads
// lib.js and the parser for scanning, never dashboard.js. The look is ui/tokens.css,
// linked by src/basic.html.
import './basic.css';
import { mount } from 'svelte';
import Basic from './Basic.svelte';

const el = document.getElementById('oh-basic');
if (el && window.OH) mount(Basic, { target: el });
