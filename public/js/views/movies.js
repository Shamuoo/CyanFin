import API from '../api.js';
import { playSound } from '../themes.js';
import { openDetail } from './detail.js';
import { mkCard } from './home.js';

let moviesStart = 0, moviesTotal = 0, moviesLoading = false;

export function initMovies() {
  document.getElementById('movies-sort').addEventListener('change', () => loadMovies());
  document.getElementById('movies-order').addEventListener('change', () => loadMovies());
  document.getElementById('movies-genre').addEventListener('change', () => loadMovies());
  document.getElementById('movies-more').addEventListener('click', () => loadMovies(true));
  document.getElementById('view-movies').addEventListener('scroll', () => {
    const el = document.getElementById('view-movies');
    const btn = document.getElementById('movies-more');
    if (!moviesLoading && btn.style.display !== 'none' && el.scrollTop + el.clientHeight >= el.scrollHeight - 300) loadMovies(true);
  });
  loadGenreFilter('movies-genre', 'Movie');
}

export async function loadMovies(append = false) {
  if (moviesLoading) return;
  if (!append) { moviesStart = 0; moviesTotal = 0; document.getElementById('movies-grid').innerHTML = ''; }
  moviesLoading = true;
  try {
    const sort = document.getElementById('movies-sort').value;
    const order = document.getElementById('movies-order').value;
    const genre = document.getElementById('movies-genre').value;
    const data = await API.movies({ sort, order, genre, start: moviesStart });
    moviesTotal = data.total || 0;
    moviesStart += (data.items || []).length;
    const countEl = document.getElementById('movies-count');
    if (countEl) countEl.textContent = moviesTotal.toLocaleString() + ' movies';
    const grid = document.getElementById('movies-grid');
    if (!append) grid.innerHTML = '';
    (data.items || []).forEach(item => grid.appendChild(mkCard(item)));
    const btn = document.getElementById('movies-more');
    btn.style.display = moviesStart < moviesTotal ? '' : 'none';
  } catch(e) {} finally { moviesLoading = false; }
}

async function loadGenreFilter(selectId, type) {
  try {
    const genres = await API.genres(type);
    const sel = document.getElementById(selectId); if (!sel) return;
    const current = sel.value;
    sel.innerHTML = '<option value="">All Genres</option>';
    genres.forEach(g => { const o = document.createElement('option'); o.value = g; o.textContent = g; if (g === current) o.selected = true; sel.appendChild(o); });
  } catch(e) {}
}
