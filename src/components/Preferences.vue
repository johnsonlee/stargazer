<template>
    <div class='preferences-container'>
        <div class='preferences-form'>
            <input type='text' placeholder='Access Token' refs='token' v-model='token' @keyup.enter='onApplySettingsClick' />
            <input type='submit' value='Apply Settings' v-on:click='onApplySettingsClick' />
            <a class='link-gen-token' href='https://github.com/settings/tokens/new?scopes=repo&description=stargazer%20browser%20extension' title="Generate new token"><i class="icon-help-circled"></i></a>
        </div>
    </div>
</template>

<script>
import '@/assets/fontello/css/help.css'

export default {
    name: 'Preferences',
    data: () => {
        return {
            token: localStorage.token || '',
        };
    },
    methods: {
        onApplySettingsClick() {
            if (this.token) {
                localStorage.token = this.token;
                this.$router.go(-1);
            }
            console.log(localStorage.token);
        },
    },
}
</script>

<style scoped>
.preferences-container {
    position: absolute;
    width: 100%;
    height: 100%;
    text-align: center;
    background: rgb(54, 53, 52);
}

.preferences-form {
    width: 100%;
    height: 60px;
    position: absolute;
    top: 50%;
    margin-top: -30px;
    line-height: 60px;
}

input {
    outline: none;
    border: 0px;
    border-radius: 3px;
    padding: 3px 8px;
    line-height: 26px;
}

input[type=text] {
    color: rgb(15, 46, 71);
    width: 300px;
}

input[type=submit] {
    color: white;
    background-color: #28a745;
    background-image: -webkit-gradient(linear,left top,left bottom,from(#34d058),color-stop(90%,#28a745));
    background-image: linear-gradient(-180deg,#34d058,#28a745 90%);
}

input:first-child {
    margin-right: 8px;
}

input:last-child {
    margin-left: 4px;
}

a.link-gen-token {
    line-height: 26px;
    margin-left: 8px;
}
.icon-help-circled {
    color: white;
}
</style>
