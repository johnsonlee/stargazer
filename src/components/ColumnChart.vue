<template>
  <div class="column-chart">
    <h3>{{ title }}</h3>
    <p class="note">{{ note }}</p>
    <ol class="columns" :aria-label="title" :style="{ '--count': rows.length }">
      <li
        v-for="(row, i) in rows"
        :key="row.label"
        :title="tooltip(row)"
        :aria-label="tooltip(row)"
      >
        <span class="plot">
          <span v-if="i === peak" class="peak">{{ formatNumber(row.count) }}</span>
          <span v-if="row.count" class="bar" :style="{ height: `${(row.count / max) * 100}%` }"></span>
        </span>
        <span class="tick" :class="{ shown: showTick(i) }">{{ row.label }}</span>
      </li>
    </ol>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { formatNumber } from '../lib/series'

const props = defineProps({
  title: { type: String, required: true },
  note: { type: String, default: '' },
  // `[{ label, count, share }]` in axis order
  rows: { type: Array, required: true },
  unit: { type: String, default: '' },
})

const max = computed(() => Math.max(1, ...props.rows.map((r) => r.count)))
// only the tallest column is labeled; the rest are read on hover
const peak = computed(() => props.rows.findIndex((r) => r.count === max.value))

// first, last and evenly spaced labels in between, so they never collide
const tickStep = computed(() => Math.max(1, Math.ceil(props.rows.length / 6)))
const showTick = (i) => i === props.rows.length - 1 || (i % tickStep.value === 0 && props.rows.length - 1 - i >= tickStep.value / 2)

const formatShare = (share) => (share > 0 && share < 0.01 ? '<1%' : `${Math.round(share * 100)}%`)
const tooltip = (row) => `${row.label}: ${formatNumber(row.count)} ${props.unit}${row.count === 1 ? '' : 's'} (${formatShare(row.share)})`
</script>

<style scoped>
.column-chart { padding: 18px 24px 16px; min-width: 0; }

h3 { margin: 0; font-size: 13px; font-weight: 600; color: var(--text-2); }
.note { margin: 1px 0 12px; font-size: 12px; color: var(--muted); }

.columns {
  display: grid;
  grid-template-columns: repeat(var(--count), minmax(0, 1fr));
  /* ticks hang below the baseline; reserve their space under the list */
  margin: 0 0 22px;
  padding: 0;
  list-style: none;
  border-bottom: 1px solid var(--axis);
}

li {
  display: flex;
  flex-direction: column;
  min-width: 0;
  /* 2px surface gap between neighbouring columns */
  padding: 0 1px;
  border-radius: 6px 6px 0 0;
  transition: background-color .15s;
}
li:hover { background: var(--surface-2); }

.plot {
  position: relative;
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
  align-items: center;
  height: 120px;
  padding-top: 18px;
}

.bar {
  display: block;
  width: 100%;
  max-width: 28px;
  min-height: 2px;
  border-radius: 4px 4px 0 0;
  background: var(--accent);
}

.peak {
  font-size: 11.5px;
  font-weight: 600;
  line-height: 16px;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}

.tick {
  position: relative;
  top: 6px;
  align-self: center;
  height: 0;
  overflow: visible;
  font-size: 11px;
  color: var(--muted);
  text-align: center;
  white-space: nowrap;
  visibility: hidden;
  font-variant-numeric: tabular-nums;
}
.tick.shown { visibility: visible; }

@container (min-width: 700px) {
  .plot { height: 160px; }
}

@container (max-width: 519px) {
  .column-chart { padding: 16px 16px 14px; }
}
</style>
