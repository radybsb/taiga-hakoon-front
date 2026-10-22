###
# This source code is licensed under the GNU Affero General Public License.
###

CardClick = ($document, popup) ->
    link = (scope, el, attrs) ->
        origin = null
        moved = false
        namespace = '.cardClick' + scope.$id
        controls = 'a, button, input, textarea, select, label, video, audio, [contenteditable], [ng-click], [role="button"], [role="link"], [tabindex], tg-card-actions, tg-card-assigned-to, .folding-actions, .add-new-task'
        interactive = (target) -> $(target).closest(controls, el[0]).length > 0
        move = (event) ->
            if origin && (Math.abs(event.clientX - origin.x) > 5 || Math.abs(event.clientY - origin.y) > 5)
                moved = true
            return
        release = (event) ->
            move(event)
            $document.off('pointermove' + namespace, move)
            $document.off('pointerup' + namespace, release)
            return
        cancel = ->
            origin = null
            $document.off(namespace)
            return
        el.on 'pointerdown' + namespace, (event) ->
            cancel()
            moved = false
            return if event.button != 0 || interactive(event.target)
            origin = {x: event.clientX, y: event.clientY}
            $document.on('pointermove' + namespace, move)
            $document.on('pointerup' + namespace, release)
            $document.on('pointercancel' + namespace, cancel)
            return
        el.on 'click' + namespace, (event) ->
            allowed = origin && !moved && !interactive(event.target)
            cancel()
            return unless allowed
            return if event.button > 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey || event.isDefaultPrevented()
            return if el.closest('.gu-mirror, .gu-transit').length
            event.preventDefault()
            event.stopPropagation()
            scope.$evalAsync ->
                target = scope.$eval(attrs.tgCardClick, {$event: event})
                popup.open(target.route, target) if target?.route
            return
        scope.$on '$destroy', ->
            cancel()
            el.off(namespace)
    return {restrict: 'A', link: link}

CardClick.$inject = ['$document', 'tgDetailPopup']
angular.module('taigaComponents').directive('tgCardClick', CardClick)
