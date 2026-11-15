<template>
  <div class="bar-list">
    <h3>{{ title }}</h3>
    <p class="note">{{ note }}</p>
    <ol v-if="rows.length" :aria-label="title">
      <li v-for="row in rows" :key="row.label" :class="{ other: row.other }" :title="tooltip(row)">
        <span class="label">{{ row.label }}</span>
        <span class="track" aria-hidden="true">
          <span v-if="!row.other && row.count" class="fill" :style="{ width: `${(row.count / max) * 100}%` }"></span>
        </span>
        <span class="value">{{ formatNumber(row.count) }}</span>
        <span class="share">{{ formatShare(row.share) }}</span>
      </li>
    </ol>
    <p v-else class="empty">{{ empty }}</p>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { formatNumber } from '../lib/series'

const props = defineProps({
  title: { type: String, required: true },
  note: { type: String, default: '' },
  // `[{ label, count, share, other? }]`, already in display order
  rows: { type: Array, required: true },
  unit: { type: String, default: '' },
  empty: { type: String, default: 'Nothing to show.' },
})

// the folded "others" row has no bar, so it doesn't flatten the ranked ones
const max = computed(() => Math.max(1, ...props.rows.filter((r) => !r.other).map((r) => r.count)))

const formatShare = (share) => (share > 0 && share < 0.01 ? '<1%' : `${Math.round(share * 100)}%`)

const tooltip = (row) => `${row.label}: ${formatNumber(row.count)} ${props.unit}${row.count === 1 ? '' : 's'} (${formatShare(row.share)})`
</script>

<style scoped>
/* Each list is its own container: rows switch to a stacked layout when the panel is
   narrow, whether that's from a phone or from sitting beside another panel. */
.bar-list { container-type: inline-size; padding: 18px 24px 20px; min-width: 0; }

h3 { margin: 0; font-size: 13px; font-weight: 600; color: var(--text-2); }
.note { margin: 1px 0 12px; font-size: 12px; color: var(--muted); }

ol { margin: 0; padding: 0; list-style: none; }

li {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto 3em;
  grid-template-areas: "label value share" "track track track";
  align-items: center;
  gap: 4px 10px;
  padding: 5px 8px;
  margin: 0 -8px;
  border-radius: 8px;
  font-size: 13px;
  font-variant-numeric: tabular-nums;
  transition: background-color .15s;
}
li:hover { background: var(--surface-2); }

.label { grid-area: label; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.other .label { color: var(--muted); }

.track { grid-area: track; height: 6px; }
.fill {
  display: block;
  min-width: 2px;
  height: 100%;
  border-radius: 0 4px 4px 0;
  background: var(--accent);
}

.value { grid-area: value; text-align: right; font-weight: 600; }
.share { grid-area: share; text-align: right; color: var(--muted); }

.empty { margin: 0; font-size: 13px; color: var(--muted); }

/* wide enough for label, bar and numbers on one line */
@container (min-width: 400px) {
  li {
    grid-template-columns: minmax(0, 9rem) minmax(0, 1fr) 3.5em 3em;
    grid-template-areas: "label track value share";
    gap: 12px;
  }
  .track { height: 8px; }
}

/* the list's own padding follows the card's width (its nearest outer container) */
@container (max-width: 519px) {
  .bar-list { padding: 16px 16px 18px; }
}
</style>
