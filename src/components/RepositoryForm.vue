<template>
    <div class="repository-container">
        <span>https://github.com/</span>
        <input type="text" placeholder="user/repository" v-model:value="value" @keyup.enter='onSubmit' />
    </div>
</template>

<script>
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
    width: 200px;
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
</style>
