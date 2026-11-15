<template>
  <div ref="el" class="chart" role="img" :aria-label="`Star history by ${granularity}`"></div>
</template>

<script setup>
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { init, use, graphic } from 'echarts/core'
import { BarChart, LineChart } from 'echarts/charts'
import { DataZoomComponent, GridComponent, TitleComponent, TooltipComponent } from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'
import { formatAxis, formatCompact, formatNumber, formatPeriod } from '../../lib/series'

use([LineChart, BarChart, GridComponent, TitleComponent, TooltipComponent, DataZoomComponent, CanvasRenderer])

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
    surface: get('--surface'),
    text: get('--text'),
    text2: get('--text-2'),
    muted: get('--muted'),
    border: get('--border-strong'),
    grid: get('--grid'),
    axis: get('--axis'),
    accent: get('--accent'),
    accentSoft: get('--accent-soft'),
    font: get('--font'),
  }
}

const withAlpha = (rgba, alpha) => rgba.replace(/[\d.]+\)$/, `${alpha})`)

// Two panels share one time axis instead of a dual-axis chart:
// cumulative total on top, new stars per period underneath.
function buildOption() {
  const t = tokens()
  const g = props.granularity
  const last = props.points.length - 1
  const labels = props.points.map((p) => formatAxis(p.start, g))
  const height = el.value.clientHeight
  const barsHeight = Math.round(height * 0.28)
  const sliderHeight = 20
  const gap = 44
  const top = 28
  const totalHeight = height - top - gap - barsHeight - 38 - sliderHeight - 14

  const axisCommon = {
    type: 'category',
    data: labels,
    boundaryGap: true,
    axisTick: { show: false },
    axisLine: { lineStyle: { color: t.axis } },
  }
  const valueAxis = (splitNumber) => ({
    type: 'value',
    splitNumber,
    axisLabel: { color: t.muted, fontSize: 11, formatter: formatCompact },
    splitLine: { lineStyle: { color: t.grid, width: 1 } },
  })
  const title = (text, topPx) => ({
    text,
    left: 0,
    top: topPx,
    textStyle: { color: t.text2, fontSize: 12, fontWeight: 600, fontFamily: t.font },
  })

  return {
    animationDuration: 450,
    animationDurationUpdate: 300,
    textStyle: { fontFamily: t.font },
    title: [
      title('Total stars', 0),
      title(`New stars per ${g}`, top + totalHeight + gap - 22),
    ],
    axisPointer: { link: [{ xAxisIndex: 'all' }] },
    grid: [
      { left: 0, right: 56, top, height: totalHeight, containLabel: true },
      { left: 0, right: 56, top: top + totalHeight + gap, height: barsHeight, containLabel: true },
    ],
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'line', lineStyle: { color: t.border, width: 1 } },
      backgroundColor: t.surface,
      borderColor: t.border,
      borderWidth: 1,
      padding: [10, 12],
      extraCssText: 'border-radius:10px;box-shadow:0 8px 24px -8px rgba(0,0,0,.25);',
      textStyle: { color: t.text, fontSize: 13 },
      formatter(params) {
        const p = props.points[params[0].dataIndex]
        const row = (label, value) => `<div style="display:flex;justify-content:space-between;gap:28px"><span style="color:${t.muted}">${label}</span><span style="font-weight:600">${value}</span></div>`
        const current = params[0].dataIndex === last ? ` <span style="color:${t.muted};font-weight:400">· so far</span>` : ''
        return `<div style="font-weight:600;margin-bottom:6px">${formatPeriod(p.start, g)}${current}</div>`
          + row('Total', formatNumber(p.total))
          + row('New', `+${formatNumber(p.added)}`)
      },
    },
    xAxis: [
      { ...axisCommon, gridIndex: 0, axisLabel: { show: false } },
      {
        ...axisCommon,
        gridIndex: 1,
        axisLabel: { color: t.muted, fontSize: 11, hideOverlap: true, margin: 10 },
      },
    ],
    yAxis: [
      { ...valueAxis(4), gridIndex: 0 },
      { ...valueAxis(2), gridIndex: 1, minInterval: 1 },
    ],
    dataZoom: [
      { type: 'inside', xAxisIndex: [0, 1], zoomOnMouseWheel: 'shift', moveOnMouseWheel: false },
      {
        type: 'slider',
        xAxisIndex: [0, 1],
        height: sliderHeight,
        bottom: 2,
        left: 2,
        right: 58,
        borderColor: t.grid,
        backgroundColor: 'transparent',
        fillerColor: t.accentSoft,
        dataBackground: { lineStyle: { color: t.axis, width: 1 }, areaStyle: { color: t.grid } },
        selectedDataBackground: { lineStyle: { color: t.accent, width: 1 }, areaStyle: { color: t.accentSoft } },
        handleStyle: { color: t.surface, borderColor: t.border },
        moveHandleStyle: { color: t.grid },
        emphasis: { handleStyle: { borderColor: t.accent }, moveHandleStyle: { color: t.accentSoft } },
        textStyle: { color: t.muted, fontSize: 11 },
        showDetail: false,
        brushSelect: false,
      },
    ],
    series: [
      {
        name: 'Total stars',
        type: 'line',
        xAxisIndex: 0,
        yAxisIndex: 0,
        data: props.points.map((p, i) => (i === last
          ? { value: p.total, symbol: 'circle', symbolSize: 9 }
          : { value: p.total, symbol: 'none' })),
        showSymbol: true,
        smooth: 0.2,
        lineStyle: { color: t.accent, width: 2, cap: 'round', join: 'round' },
        itemStyle: { color: t.accent, borderColor: t.surface, borderWidth: 2 },
        emphasis: { disabled: true },
        areaStyle: {
          color: new graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: withAlpha(t.accentSoft, 0.16) },
            { offset: 1, color: withAlpha(t.accentSoft, 0.01) },
          ]),
        },
        endLabel: {
          show: true,
          formatter: ({ value }) => formatCompact(value),
          color: t.text,
          fontSize: 12,
          fontWeight: 600,
          distance: 8,
        },
      },
      {
        name: `New per ${g}`,
        type: 'bar',
        xAxisIndex: 1,
        yAxisIndex: 1,
        // the current period is still in progress, so it is drawn faded
        data: props.points.map((p, i) => (i === last
          ? { value: p.added, itemStyle: { opacity: 0.4 } }
          : p.added)),
        itemStyle: { color: t.accent, borderRadius: [4, 4, 0, 0] },
        emphasis: { itemStyle: { color: t.accent } },
        barMaxWidth: 24,
        barCategoryGap: '24%',
      },
    ],
  }
}

function render() {
  if (chart) chart.setOption(buildOption(), { notMerge: true })
}

function download(filename) {
  const url = chart.getDataURL({ type: 'png', pixelRatio: 2, backgroundColor: tokens().surface, excludeComponents: ['dataZoom'] })
  const a = document.createElement('a')
  a.href = url
  a.download = `${filename}.png`
  a.click()
}

defineExpose({ download })

onMounted(() => {
  chart = init(el.value)
  render()
  resizeObserver = new ResizeObserver(() => {
    chart.resize()
    // panel heights depend on the container; merge only the layout so zoom survives
    const { grid, title } = buildOption()
    chart.setOption({ grid, title })
  })
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
  height: clamp(360px, 54vh, 500px);
}
</style>
