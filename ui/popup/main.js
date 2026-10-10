// The toolbar popup (the connector build; src/popup.html). Mounted alone: it loads
// lib.js for the stored data and the ship prices, never dashboard.js.
import '../tokens.css';
import './popup.css';
import { mount } from 'svelte';
import Popup from './Popup.svelte';

const el = document.getElementById('oh-popup');
if (el && window.OH) mount(Popup, { target: el });
