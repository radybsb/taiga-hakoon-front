###
# This source code is licensed under the terms of the
# GNU Affero General Public License found in the LICENSE file in
# the root directory of this source tree.
#
# Copyright (c) 2021-present Kaleidos INC
###

# Keep native selects on desktop; anchor smaller-screen menus in the document.
PresetSelectDirective = ($compile, $document, $window, $timeout) ->
    sequence = 0
    link = (scope, element, attrs, controllers) ->
        [model, select] = controllers
        selectElement = element[0]
        state = scope.$new()
        id = "preset-options-#{++sequence}"
        wrapper = angular.element('<span class="preset-select-wrapper"></span>')
        element.wrap(wrapper)
        wrapper = element.parent()
        control = angular.element("""
            <span class="preset-select-control">
                <button type="button" class="preset-select-trigger" role="combobox"
                    aria-haspopup="listbox" aria-controls="#{id}"
                    aria-expanded="{{preset.open}}" aria-label="{{preset.label}}"
                    ng-disabled="preset.disabled" ng-click="preset.toggle()">
                    <span>{{preset.text}}</span>
                    <tg-svg svg-icon="icon-arrow-down"></tg-svg>
                </button>
                <ul id="#{id}" class="preset-select-options" role="listbox"
                    aria-label="{{preset.label}}" ng-show="preset.open"
                    ng-class="{'opens-above': preset.above}" ng-style="preset.menuStyle">
                    <li ng-repeat="option in preset.options track by option.index" role="presentation">
                        <button type="button" role="option" tabindex="-1"
                            aria-selected="{{option.index === preset.selected}}"
                            ng-class="{selected: option.index === preset.selected}"
                            ng-disabled="option.disabled" ng-click="preset.choose(option)">{{option.text}}</button>
                    </li>
                </ul>
            </span>
        """)
        wrapper.append(control)
        label = selectElement.labels?[0]
        state.preset = preset = {open: false, options: [], label: label?.textContent.trim() or attrs.ariaLabel or attrs.id}
        pendingFocus = null
        destroyed = false
        sync = ->
            return if destroyed
            preset.disabled = selectElement.disabled
            preset.selected = selectElement.selectedIndex
            preset.text = selectElement.options[selectElement.selectedIndex]?.text or ''
            preset.options = ({index: index, text: option.text, disabled: option.disabled or option.hidden, hidden: option.hidden} for option, index in selectElement.options)

        focusOption = (index) ->
            $timeout.cancel(pendingFocus) if pendingFocus
            pendingFocus = $timeout (->
                buttons = control[0].querySelectorAll('[role="option"]')
                buttons[index]?.focus()
            ), 0, false

        close = (restore = false) ->
            preset.open = false
            $timeout.cancel(pendingFocus) if pendingFocus
            control[0].querySelector('.preset-select-trigger').focus() if restore

        preset.toggle = ->
            return close() if preset.open
            sync()
            return if preset.disabled
            rect = wrapper[0].getBoundingClientRect()
            below = $window.innerHeight - rect.bottom - 12
            preset.above = below < 200 and rect.top > below
            available = if preset.above then rect.top - 12 else below
            menuWidth = Math.max(rect.width, Math.min(192, $window.innerWidth - 24))
            menuLeft = Math.max(12 - rect.left, Math.min(0, $window.innerWidth - 12 - rect.left - menuWidth))
            preset.menuStyle = {
                maxHeight: "#{Math.max(48, Math.min(288, available))}px"
                width: "#{menuWidth}px"
                left: "#{menuLeft}px"
            }
            preset.open = true
            index = if preset.selected >= 0 and not preset.options[preset.selected]?.disabled then preset.selected else preset.options.findIndex((option) -> not option.disabled)
            focusOption(index)

        preset.choose = (option) ->
            return if selectElement.disabled or option.disabled
            selectElement.selectedIndex = option.index
            # Use the native ng-options value mapping, including numeric/null values.
            if model
                model.$setViewValue(select.readValue())
                model.$render()
            else
                # Members saves role changes through its delegated change handler.
                element.trigger('change')
            sync()
            close(true)

        onKey = (event) ->
            return unless $window.matchMedia('(max-width: 1199px)').matches
            if event.key == 'Escape' and preset.open
                event.preventDefault()
                event.stopPropagation()
                state.$apply -> close(true)
            else if event.key == 'Tab'
                state.$apply -> close()
            else if event.key in ['ArrowDown', 'ArrowUp', 'Home', 'End']
                event.preventDefault()
                state.$apply ->
                    return preset.toggle() unless preset.open
                    buttons = Array.from(control[0].querySelectorAll('[role="option"]'))
                    enabled = buttons.filter((button) -> not button.disabled)
                    return unless enabled.length
                    index = enabled.indexOf($document[0].activeElement)
                    target = switch event.key
                        when 'Home' then 0
                        when 'End' then enabled.length - 1
                        when 'ArrowDown' then (index + 1) % enabled.length
                        else (index - 1 + enabled.length) % enabled.length
                    enabled[target].focus()

        onOutside = (event) ->
            state.$apply(-> close()) if preset.open and not wrapper[0].contains(event.target)
        media = $window.matchMedia('(max-width: 1199px)')
        onResize = -> state.$evalAsync(-> close()) unless destroyed or media.matches
        media.addListener(onResize)
        control.on('keydown', onKey)
        $document.on('click', onOutside)
        observer = new $window.MutationObserver(-> state.$evalAsync(sync) unless destroyed)
        observer.observe(selectElement, {childList: true, subtree: true, characterData: true, attributes: true})
        stop = scope.$watch((-> if model then model.$viewValue else selectElement.value), sync)
        attrs.$observe 'ariaLabel', (value) -> preset.label = value if value
        $compile(control)(state)
        sync()
        scope.$on '$destroy', ->
            destroyed = true
            observer.disconnect()
            stop()
            media.removeListener(onResize)
            $document.off('click', onOutside)
            control.off('keydown', onKey)
            $timeout.cancel(pendingFocus) if pendingFocus
            state.$destroy()

    return {restrict: 'A', require: ['?ngModel', 'select'], link: link}

angular.module('taigaAdmin').directive('tgPresetSelect', ['$compile', '$document', '$window', '$timeout', PresetSelectDirective])
