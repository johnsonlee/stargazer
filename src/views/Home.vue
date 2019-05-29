<template>
    <div>
        <div class="topbar">
            <input type="text" placeholder="user/repository" v-model:value="repository" />
            <input type="submit" value="Submit" v-on:click="loadStarTrending" />
        </div>
        <div class="content">
            <Preferences v-if="isTokenNotFound()" />
            <StarTrendingChart :height="chartHeight" />
        </div>
    </div>
</template>

<script>
import Vue from 'vue'
import Preferences from '../components/Preferences.vue'
import StarTrendingChart from '../components/chart/StarTrendingChart.vue'

export default {
    name: 'Home',
    components: {
        StarTrendingChart,
        Preferences,
    },
    props: [ 'route' ],
    data: () => ({
        chartHeight: '',
        repository: '',
    }),
    created() {
        this.chartHeight = `${window.innerHeight - 60}px`;
        this.repository = this.route.path.replace(/^\//, '');
    },
    methods: {
        loadStarTrending() {
            const repo = this.repository.replace(/^\//, '');
            if (!repo) {
                return;
            }
            console.log(`Loading star trending of repo ${repo}`);
            this.$router.push(`/${repo}`);
        },
        isTokenNotFound() {
            const token = !!!localStorage.token;
            return token;
        },
    },
    watch: {
    },
}
</script>

<style scoped>
.topbar {
    height: 60px;
    line-height: 60px;
    background: rgb(54, 53, 52);
    text-align: center;
}

.topbar input[type=text] {
    width: 300px;
}
</style>

<style>

input {
    outline: none;
    border: 0px;
    padding: 3px 12px;
    line-height: 26px;
}

input[type=submit] {
    border-radius: 3px;
    background-color: #28a745;
    background-image: linear-gradient(-180deg,#34d058,#28a745 90%);
    color: #fff;
    line-height: 26px;
}

input[type=submit]:last-child {
    margin-left: 8px;
}

.content {
    height: -webkit-calc(100% - 60px);
    height: -moz-calc(100% - 60px);
    height: calc(100% - 60px);
    top: 60px;
    left: 0px;
    right: 0px;
    bottom: 0px;
    position: absolute;
}
</style>
