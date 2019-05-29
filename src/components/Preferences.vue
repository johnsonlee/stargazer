<template>
    <div class="preferences">
        <input type="text" placeholder="Access Token" v-model="token" />
        <input type="submit" value="Apply Settings" v-on:click="applySettings" />
        <a class="link-gen-token" href="https://github.com/settings/tokens/new?scopes=repo&description=stargazer%20browser%20extension">generate new token</a>
    </div>
</template>

<script>
export default {
    name: 'Preferences',
    data: () => {
        return {
            token: localStorage.token || '',
        };
    },
    methods: {
        applySettings() {
            if (this.token) {
                localStorage.token = this.token;
            }
        },
    },
}
</script>

<style>
.preferences {
    position: absolute;
    width: 100%;
    height: 100%;
    padding: 12px;
    text-align: center;
    background: rgba(54, 53, 52, 0.9);
    z-index: 10000;
}
</style>

<style scoped>
.preferences input[type=text] {
    color: rgb(15, 46, 71);
    border-radius: 3px;
    width: 200px;
    line-height: 26px;
}

.preferences input:first-child {
    margin-right: 8px;
}
.preferences input:last-child {
    margin-left: 4px;
}

a.link-gen-token {
    margin-left: 8px;
}
</style>
