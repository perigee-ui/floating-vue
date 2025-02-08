<script setup lang="ts">
import { shallowRef } from 'vue'
import Option from './Option.vue'
import Select from './Select.vue'

let isTrue = true
const fragment = shallowRef<string[]>(['Five', 'Six'])

function toggle() {
  isTrue = !isTrue

  if (isTrue)
    fragment.value = ['Five', 'Six']
  else
    fragment.value = ['Six', 'Five']
}
</script>

<template>
  <div>
    <div>
      <button class="text-left flex py-1 px-2 bg-blue-500 text-white rounded mt-4 text-sm mb-4" @click="toggle">
        Change order
      </button>
    </div>
    <div>
      <Select>
        <Option>One</Option>
        <div>
          <Option>Two</Option>
          <Option>Three</Option>
          <Option>Four</Option>
        </div>
        <Option v-for="item in fragment" :key="item">
          {{ item }}
        </Option>
      </Select>
    </div>
  </div>
</template>
