import Fuse from 'fuse.js'
import React, { useId, useRef, useState } from 'react'
import { ChevronDown } from 'react-feather'
import { twMerge } from 'tailwind-merge'
import { useOutsideClick } from '../../hooks/useOutsideClick'
import { useMount } from '../../hooks/useMount'

/**
 * Accessible fuzzy-searchable combobox dropdown component.
 *
 * Uses a scoped container ref for option scrolling so it works inside both
 * the popup document and Shadow DOM without colliding across instances.
 */
export function Dropdown(props) {
  const inputId = useId()
  const listboxId = useId()
  const inputRef = useRef(null)
  const listRef = useRef(null)
  const [open, setOpen] = useState(false)
  const [input, setInput] = useState(props.value)
  const [dirty, setDirty] = useState(false)
  const [index, setIndex] = useState(
    Math.max(
      0,
      props.options.findIndex((o) => o.value === props.value),
    ),
  )
  const selectedOption = props.options.find((o) => o.value === props.value)

  const fuse = new Fuse(props.options, {
    keys: ['value', 'title', 'description'],
    threshold: 0.4,
  })

  const options =
    dirty && input
      ? fuse.search(input).map((result) => result.item)
      : props.options

  if (!options.length) {
    options.push({
      title: 'No results found',
      value: '',
      disabled: true,
      description: 'Try a different search',
    })
  }

  function handleChange(e) {
    const value = e?.currentTarget?.value ?? ''
    setDirty(true)
    setInput(value)
    setIndex(
      value
        ? 0
        : Math.max(
            0,
            props.options.findIndex((o) => o.value === props.value),
          ),
    )
  }

  function handleClick(option) {
    if (!option || option.disabled) return
    setDirty(false)
    setInput(option.value)
    props.onChange(option.value)
    handleClose()
  }

  function handleClose() {
    setOpen(false)
    setDirty(false)
    setInput(props.value)
    setIndex(
      Math.max(
        0,
        props.options.findIndex((o) => o.value === props.value),
      ),
    )
  }

  function handleOpen() {
    if (props.disabled) return
    setOpen(true)
    setDirty(false)
    if (inputRef.current) inputRef.current.select()
  }

  function scrollIntoView({ nextIndex, previousIndex }) {
    const targetIndex = nextIndex ?? previousIndex
    const containerEl = listRef.current
    if (!containerEl || !options[targetIndex]) return

    const ref = containerEl.querySelector(
      `[data-option-index="${targetIndex}"]`,
    )
    if (!ref) return

    const isOutOfView =
      ref.offsetTop < containerEl.scrollTop ||
      ref.offsetTop + ref.offsetHeight >
        containerEl.scrollTop + containerEl.offsetHeight

    // Pointer events are disabled during the scroll in order to prevent
    // mouseover events from firing while scrolling which would cause
    // the index to change and the scroll to jump around.
    containerEl.style.pointerEvents = 'none'
    ref.scrollIntoView({ block: 'nearest' })

    if (nextIndex !== undefined && isOutOfView) containerEl.scrollTop += 4
    if (previousIndex !== undefined && isOutOfView) containerEl.scrollTop -= 4
    setTimeout(() => {
      if (containerEl) containerEl.style.pointerEvents = 'auto'
    }, 0)
  }

  function handleKeydown(e) {
    switch (e.key) {
      case 'Escape':
        e.preventDefault()
        e.stopPropagation()
        handleClose()
        e.currentTarget?.blur()
        break
      case 'Enter':
        e.preventDefault()
        e.stopPropagation()
        if (options[index] && !options[index].disabled) {
          handleClick(options[index])
        }
        break
      case 'ArrowDown': {
        e.preventDefault()
        e.stopPropagation()
        if (!open) {
          setOpen(true)
          break
        }
        const nextIndex = (index + 1) % options.length
        setIndex(nextIndex)
        scrollIntoView({ nextIndex })
        break
      }
      case 'ArrowUp': {
        e.preventDefault()
        e.stopPropagation()
        if (!open) {
          setOpen(true)
          break
        }
        const previousIndex = (index - 1 + options.length) % options.length
        setIndex(previousIndex)
        scrollIntoView({ previousIndex })
        break
      }
      case 'Tab':
        handleClose()
        break
    }
  }

  function handleMouseOver(e) {
    const idx = Number(e?.currentTarget?.dataset?.optionIndex)
    if (!Number.isNaN(idx)) setIndex(idx)
  }

  const displayValue = dirty ? input : selectedOption?.title || ''

  return (
    <div
      className="relative font-medium text-xs"
      ref={useOutsideClick(handleClose)}
      onClick={handleOpen}
    >
      <label
        htmlFor={inputId}
        className="bg-white absolute text-xxs font-medium -top-2 left-2 px-1 text-neutral-600 z-10 pointer-events-none"
      >
        {props.label}
      </label>

      <Options open={open} id={listboxId} listRef={listRef}>
        {options.map((option, i) => (
          <Option
            id={`${listboxId}-opt-${i}`}
            index={i}
            selected={option.value === props.value}
            focused={i === index}
            option={option}
            key={`option-${option.value}:${i}`}
            onClick={handleClick}
            onMouseOver={handleMouseOver}
          />
        ))}
      </Options>

      <div className="relative flex items-center">
        <input
          id={inputId}
          ref={inputRef}
          role="combobox"
          aria-expanded={open}
          aria-controls={listboxId}
          aria-autocomplete="list"
          aria-activedescendant={
            open && options[index] ? `${listboxId}-opt-${index}` : undefined
          }
          type="text"
          className="border border-neutral-200 h-9 pl-3 pr-7 py-1 outline-none rounded-md w-full text-neutral-900 bg-white transition-colors focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15 truncate"
          placeholder={props.placeholder}
          value={displayValue}
          onChange={handleChange}
          disabled={props.disabled}
          onKeyDown={handleKeydown}
          onFocus={handleOpen}
          onClick={handleOpen}
        />
        <ChevronDown
          size={14}
          aria-hidden="true"
          className={twMerge(
            'absolute right-2.5 text-neutral-400 pointer-events-none transition-transform duration-150',
            open && 'rotate-180 text-blue-600',
          )}
        />
      </div>
    </div>
  )
}

function Options(props) {
  if (!props.open) return null

  function handleRef(ref) {
    if (props.listRef) props.listRef.current = ref
    if (!ref) return

    const boundings = ref.getBoundingClientRect()
    const maxHeight = Math.max(140, window.innerHeight - boundings?.top - 12)
    ref.style.maxHeight = `${maxHeight}px`
  }

  return (
    <div
      id={props.id}
      role="listbox"
      ref={handleRef}
      className="absolute top-10 left-0 w-full z-30 rounded-md border border-neutral-200 bg-white shadow-lg overflow-y-auto overflow-x-hidden"
      onMouseEnter={props.onMouseEnter}
      style={{ overscrollBehavior: 'none' }}
    >
      {props.children}
    </div>
  )
}

function Option(props) {
  const ref = useRef(null)

  useMount(function () {
    if (props.selected && ref.current)
      ref.current.scrollIntoView({ block: 'nearest', inline: 'nearest' })
  })

  function handleClick(e) {
    e.preventDefault()
    e.stopPropagation()
    if (!props.option.disabled) props.onClick(props.option)
  }

  return (
    <div
      id={props.id}
      ref={ref}
      role="option"
      aria-selected={props.selected}
      aria-disabled={props.option.disabled}
      className={twMerge(
        'flex flex-col px-2.5 py-1.5 m-1 rounded cursor-pointer transition-colors',
        !props.selected && 'hover:bg-neutral-100 text-neutral-800',
        props.selected && 'bg-blue-50 text-blue-900 font-semibold',
        props.focused && !props.selected && 'bg-neutral-100',
        props.focused && props.selected && 'bg-blue-100/80',
        props.option.disabled && 'opacity-60 cursor-default',
      )}
      onClick={handleClick}
      data-value={props.option.value}
      data-option-index={props.index}
      onMouseOver={props.onMouseOver}
    >
      <span className="truncate">{props.option.title}</span>
      {props.option.description && (
        <span className="text-xxs text-neutral-500 font-normal truncate">
          {props.option.description}
        </span>
      )}
    </div>
  )
}
