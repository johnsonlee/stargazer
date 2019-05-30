<template>
    <div class="repository-container">
        <a class="link-github" href="https://github.com/johnsonlee/stargazer"><i class="icon-github-circled"></i></a>
        <span>https://github.com/</span>
        <input type="text" placeholder="user/repository" v-model:value="value" @keyup.enter='onSubmit' />
    </div>
</template>

<script>
import '@/assets/icons/css/icons.css'

export default {
    name: 'RepositoryForm',
    props: ['repository', 'height'],
    data: () => ({
        repo: '',
    }),
    created() {
        this.value = this.repository;
    },
    methods: {
        onSubmit(event) {
            const repo = this.value.replace(/^\//, '');
            console.log(`Submit repository: ${this.value}`);
            this.$router.push(`/${repo}`);
            this.$emit('repositorychanged', repo);
        },
    },
}
</script>

<style scoped>
.repository-container {
    padding: 0 8px;
    height: 60px;
    line-height: 60px;
    background: rgb(54, 53, 52);
    text-align: center;
}

span {
    color: white;
    margin-right: 8px;
}

input[type=text] {
    border: 0px;
    border-bottom: 1px dashed #ccc;
    outline: none;
    height: 32px;
    line-height: 32px;
    padding: 3px 8px;
    color: white;
    background: transparent;
}

input[type=text]:focus {
    border-bottom: 1px dashed rgba(204,204,204,0.75);
    box-shadow: 0px 4px 4px -5px #19d4ae;
}

a.link-github {
    float: left;
    display: inline-block;
    margin: 0px;
    padding: 0px;
    width: 32px;
    height: 32px;
}

.icon-github-circled {
    color: white;
    font-size: 32px;
}

@media (max-width: 320px) {
    input[type=text] {
        width: 100px;
    }
}

@media (min-width: 321px) and (max-width: 480px) {
    input[type=text] {
        width: 150px;
    }
}

@media (min-width: 481px) and (max-width: 767px) {
    input[type=text] {
        width: 180px;
    }
}

@media (min-width: 768px) {
    input[type=text] {
        width: 300px;
    }
}

</style>
