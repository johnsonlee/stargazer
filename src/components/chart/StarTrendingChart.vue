<template>
    <ve-line
        :data='dataset'
        :height='height'
        :data-empty='empty'
        :loading='loading'
        :toolbox='toolbox' />
</template>

<script>
import Vue from 'vue'
import _ from 'lodash'
import moment from 'moment'
import 'v-charts/lib/style.css'
import v3 from '../../github/api/v3'

function rangeInDate(start, end) {
    const days = [];
    for (var i = new Date(start.getTime()); i < end;) {
        days.push(new Date(i.getTime()));
        i.setDate(i.getDate() + 1)
    }
    days.push(end);
    return days;
};

export default {
    name: 'StarTrendingChart',
    props: ['height'],
    data: () => ({
        empty: false,
        loading: false,
        dataset: {
            columns: [],
            rows: [],
        },
        toolbox: {
            feature: {
                magicType: {
                    type: ['line', 'bar'],
                },
                saveAsImage: {},
            },
        },
    }),
    created() {
    },
    mounted() {
        this.reload(this.$route.path.replace(/^\//, ''));
    },
    methods: {
        async reload(id) {
            const repo = await v3.fetchRepository(id || this.$route.path.replace(/^\//, ''), localStorage.token || '')
            if (!(repo && repo.created_at)) {
                return;
            }

            this.loading = true;
            const createdAt = new Date(moment(repo.created_at).format('MM-DD-YYYY'));
            const today = new Date(moment().format('MM-DD-YYYY'));
            const days = _.map(rangeInDate(createdAt, today), it => moment(it).format('YYYY-MM-DD'));
            const stargazers = await v3.fetchStargazers(this.$route.path, localStorage.token || '');
            const stars = _.groupBy(_.map(stargazers, it => ({
                starred_at: it.starred_at.substr(0, 10)
            })), it => it.starred_at)
            const daily = _.map(days, date => ({
                date: date,
                star: (stars[date] || []).length,
            }));
            this.dataset = {
                columns: [ 'date', 'star' ],
                rows: _.map(_.reduce(daily, (acc, i) => {
                    acc.push({
                        date: i.date,
                        star: (acc.length > 0 ? _.last(acc) : { star: 0 }).star + i.star,
                    });
                    return acc;
                }, []), it => ({
                    date: moment(it.date, 'YYYY-MM-DD').format('MM/DD/YYYY'),
                    star: it.star,
                })),
            };
            this.empty = this.dataset.length > 0;
            this.loading = false;
            _.forEach(this.dataset.rows, it => {
                console.log(JSON.stringify(it));
            });
        },
    },
}
</script>
