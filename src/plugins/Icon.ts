import type { Component } from 'vue'
import { Icon as IconifyIcon } from '@iconify/vue'
import type { IconifyIconSize } from '@iconify/vue'
import { defineComponent, h } from 'vue'

const Icon: Component = defineComponent({
    name: 'Icon',
    inheritAttrs: false,
    props: {
        name: {
            type: String,
            required: true
        },
        size: {
            type: [String, Number],
            default: undefined
        }
    },
    setup(props, { attrs }) {
        const coerceSize = (value: unknown): IconifyIconSize | undefined => {
            if (typeof value === 'string' || typeof value === 'number') {
                return value
            }
            return undefined
        }

        return () => {
            const { width, height, ...otherAttrs } = attrs as Record<string, unknown>
            return h(IconifyIcon, {
                icon: props.name,
                width: props.size ?? coerceSize(width),
                height: props.size ?? coerceSize(height),
                ...otherAttrs
            })
        }
    }
})

export default Icon
