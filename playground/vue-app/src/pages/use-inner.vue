<script setup lang="ts">
import Base from '@/components/UseInner/Base.vue'
import Fallback from '@/components/UseInner/Fallback.vue'
import Offset from '@/components/UseInner/Offset.vue'
</script>

<template>
  <div>
    <h1 class="text-5xl font-bold underline mb-6">
      <a href="https://floating-ui.com/docs/useInner" target="_blank" rel="noopener noreferrer">useInner</a>
    </h1>

    <div class="box before:content-['Base']">
      <Base />
    </div>
    <div class="box before:content-['Offset']">
      <Offset />
    </div>
    <div class="mb-200">
      <div class="box before:content-['Fallback']">
        <Fallback />
      </div>
    </div>
  </div>
</template>
