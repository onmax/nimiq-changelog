<script setup>
useHead({
  meta: [
    { name: 'viewport', content: 'width=device-width, initial-scale=1' }
  ],
  link: [
    { rel: 'icon', href: '/favicon.ico' }
  ],
  htmlAttrs: {
    lang: 'en'
  }
})

const title = 'Nimiq Changelog'
const description = 'Discover the latest releases from Nimiq ecosystem projects.'

useSeoMeta({
  title,
  description,
  ogTitle: title,
  ogDescription: description
})
</script>

<template>
  <UApp>
    <div class="min-h-screen xl:grid xl:grid-cols-2">
      <UPageSection
        title="Changelog"
        :description
        orientation="vertical"
        :links="[{
          label: 'Nimiq Website',
          icon: 'i-nimiq:logos-nimiq-mono',
          ui: {
            leadingIcon: 'mr-1 size-4'
          },
          class: 'nq-arrow nq-pill-blue',
          variant: 'ghost',
          size: 'lg',
          to: 'https://nimiq.com',
          target: '_blank'
        }, {
          label: 'Source Code',
          icon: 'i-nimiq:logos-github-mono',
          ui: {
            leadingIcon: 'mr-1 size-4'
          },
          class: 'nq-arrow nq-pill-tertiary bg-transparent!',
          variant: 'ghost',
          size: 'lg',
          to: 'https://github.com/onmax/nimiq-changelog',
          target: '_blank'
        }]"
        :ui="{
          root: 'border-b border-primary-200 xl:border-b-0 xl:sticky xl:inset-y-0 xl:h-screen overflow-hidden',
          container: 'h-full items-center justify-center',
          wrapper: 'flex flex-col bg-pink!',
          headline: 'mb-6 text-neutral',
          title: 'text-left text-4xl',
          description: 'text-left max-w-md text-pretty',
          links: 'gap-2 justify-start -ms-2.5'
        }"
      >
        <template #top>
          <SkyBg />

          <div class="absolute -right-1/2 z-[-1] rounded-full bg-primary blur-[300px] size-60 sm:size-100 transform -translate-y-1/2 top-1/2" />
        </template>

        <template #headline>
          <AppLogo class="w-auto h-6 shrink-0 text-highlighted" />
        </template>

        <template #default />
      </UPageSection>

      <section class="px-4 sm:px-6 xl:px-0 xl:-ms-30 xl:flex-1">
        <UColorModeButton class="fixed top-4 right-4 z-10" />

        <NuxtPage />
      </section>
    </div>
  </UApp>
</template>
