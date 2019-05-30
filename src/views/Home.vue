<template>
    <div>
        <RepositoryForm :repository='repository' v-on:repositorychanged='onRepositoryChanged' />
        <StarTrendingChart :height='starTrendingChartHeight' ref='starTrendingChart' />
    </div>
</template>

<script>
import Vue from 'vue'
import Preferences from '../components/Preferences.vue'
import RepositoryForm from '../components/RepositoryForm.vue'
import StarTrendingChart from '../components/chart/StarTrendingChart.vue'

export default {
    name: 'Home',
    components: {
        Preferences,
        RepositoryForm,
        StarTrendingChart,
    },
    props: [ 'route' ],
    data: () => ({
        repository: '',
        starTrendingChartHeight: '0px',
    }),
    created() {
        this['starTrendingChartHeight'] = `${window.innerHeight - 60}px`;
        this.repository = this.route.path.replace(/^\//, '');
    },
    methods: {
        onRepositoryChanged(repo) {
            this.$refs.starTrendingChart.reload(repo);
        },
    },
}
</script>
