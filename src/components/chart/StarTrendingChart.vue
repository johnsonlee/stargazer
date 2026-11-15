<template>
  <div ref="el" class="chart" role="img" :aria-label="`Star history by ${granularity}`"></div>
</template>

<script setup>
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { init, use, graphic } from 'echarts/core'
import { BarChart, LineChart } from 'echarts/charts'
import { DataZoomComponent, GridComponent, LegendComponent, TooltipComponent } from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'
import { formatAxis, formatCompact, formatNumber, formatPeriod } from '../../lib/series'

use([LineChart, BarChart, GridComponent, TooltipComponent, DataZoomComponent, LegendComponent, CanvasRenderer])

const props = defineProps({
  points: { type: Array, required: true },
  granularity: { type: String, required: true },
})

const el = ref(null)
let chart = null
let resizeObserver = null
const scheme = window.matchMedia('(prefers-color-scheme: dark)')

function tokens() {
  const css = getComputedStyle(document.documentElement)
  const get = (name) => css.getPropertyValue(name).trim()
  return {
    bg: get('--surface'),
    text: get('--text'),
    muted: get('--muted'),
    border: get('--border-strong'),
    grid: get('--grid'),
    accent: get('--accent'),
    accentSoft: get('--accent-soft'),
    bar: get('--bar'),
    font: get('--font'),
  }
}

function buildOption() {
  const t = tokens()
  const g = props.granularity
  const narrow = el.value.clientWidth < 560
  const dot = (color) => `<span style="display:inline-block;width:8px;height:8px;border-radius:2px;margin-right:8px;background:${color}"></span>`

  return {
    animationDuration: 500,
    animationDurationUpdate: 350,
    textStyle: { fontFamily: t.font },
    grid: { left: 8, right: 8, top: 44, bottom: 64, containLabel: true },
    legend: {
      top: 0,
      left: 0,
      itemWidth: 10,
      itemHeight: 10,
      itemGap: 18,
      icon: 'roundRect',
      textStyle: { color: t.muted, fontSize: 12 },
      data: ['Total stars', `New per ${g}`],
    },
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'line', lineStyle: { color: t.border, width: 1 } },
      backgroundColor: t.bg,
      borderColor: t.border,
      borderWidth: 1,
      padding: [10, 12],
      extraCssText: 'border-radius:10px;box-shadow:0 10px 30px -10px rgba(0,0,0,.35);',
      textStyle: { color: t.text, fontSize: 13 },
      formatter(params) {
        const p = props.points[params[0].dataIndex]
        return `<div style="font-weight:600;margin-bottom:6px">${formatPeriod(p.start, g)}</div>`
          + `<div style="display:flex;align-items:center;justify-content:space-between;gap:24px">`
          + `<span>${dot(t.accent)}Total</span><b>${formatNumber(p.total)}</b></div>`
          + `<div style="display:flex;align-items:center;justify-content:space-between;gap:24px;color:${t.muted}">`
          + `<span>${dot(t.bar)}New</span><span>+${formatNumber(p.added)}</span></div>`
      },
    },
    xAxis: {
      type: 'category',
      data: props.points.map((p) => formatAxis(p.start, g)),
      boundaryGap: true,
      axisLine: { lineStyle: { color: t.border } },
      axisTick: { show: false },
      axisLabel: { color: t.muted, fontSize: 11, hideOverlap: true, margin: 12 },
    },
    yAxis: [
      {
        type: 'value',
        position: 'left',
        splitNumber: 4,
        axisLabel: { color: t.muted, fontSize: 11, formatter: formatCompact },
        splitLine: { lineStyle: { color: t.grid, type: [4, 4] } },
      },
      {
        type: 'value',
        position: 'right',
        splitNumber: 4,
        show: !narrow,
        axisLabel: { color: t.muted, fontSize: 11, formatter: formatCompact },
        splitLine: { show: false },
      },
    ],
    dataZoom: [
      { type: 'inside', zoomOnMouseWheel: 'shift', moveOnMouseWheel: false },
      {
        type: 'slider',
        height: 22,
        bottom: 8,
        borderColor: 'transparent',
        backgroundColor: t.grid,
        fillerColor: t.accentSoft,
        dataBackground: { lineStyle: { color: t.border }, areaStyle: { color: t.grid } },
        selectedDataBackground: { lineStyle: { color: t.accent }, areaStyle: { color: t.accentSoft } },
        handleStyle: { color: t.bg, borderColor: t.border },
        moveHandleStyle: { color: t.border },
        textStyle: { color: t.muted, fontSize: 11 },
        brushSelect: false,
      },
    ],
    series: [
      {
        name: `New per ${g}`,
        type: 'bar',
        yAxisIndex: 1,
        data: props.points.map((p) => p.added),
        itemStyle: { color: t.bar, opacity: 0.55, borderRadius: [3, 3, 0, 0] },
        emphasis: { itemStyle: { opacity: 0.9 } },
        barMaxWidth: 18,
        large: true,
        z: 2,
      },
      {
        name: 'Total stars',
        type: 'line',
        yAxisIndex: 0,
        data: props.points.map((p) => p.total),
        showSymbol: false,
        symbol: 'circle',
        symbolSize: 8,
        smooth: 0.25,
        lineStyle: { color: t.accent, width: 2.5 },
        itemStyle: { color: t.accent, borderColor: t.bg, borderWidth: 2 },
        z: 3,
      },
      {
        // Area fill drawn as its own series beneath the bars so it doesn't tint them
        type: 'line',
        yAxisIndex: 0,
        data: props.points.map((p) => p.total),
        showSymbol: false,
        smooth: 0.25,
        silent: true,
        tooltip: { show: false },
        lineStyle: { width: 0 },
        areaStyle: {
          color: new graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: t.accentSoft.replace(/[\d.]+\)$/, '0.32)') },
            { offset: 1, color: t.accentSoft.replace(/[\d.]+\)$/, '0)') },
          ]),
        },
        z: 1,
      },
    ],
  }
}

function render() {
  if (chart) chart.setOption(buildOption(), { notMerge: true })
}

function download(filename) {
  const url = chart.getDataURL({ type: 'png', pixelRatio: 2, backgroundColor: tokens().bg, excludeComponents: ['dataZoom'] })
  const a = document.createElement('a')
  a.href = url
  a.download = `${filename}.png`
  a.click()
}

defineExpose({ download })

onMounted(() => {
  chart = init(el.value)
  render()
  resizeObserver = new ResizeObserver(() => chart.resize())
  resizeObserver.observe(el.value)
  scheme.addEventListener('change', render)
})

onBeforeUnmount(() => {
  scheme.removeEventListener('change', render)
  resizeObserver?.disconnect()
  chart?.dispose()
})

watch(() => [props.points, props.granularity], render)
</script>

<style scoped>
.chart {
  width: 100%;
  height: clamp(320px, 56vh, 520px);
}
</style>
