# Touch sorting requires a deliberate hold; mouse sorting keeps Dragula's behavior.
# Keep this adapter shared by the boards and the manually ordered lists.
@taiga.touchDragula = (containers, options = {}) ->
    doc = document
    host = doc.documentElement
    pending = null
    timer = null
    ready = false
    touching = false
    probing = false
    replaying = false
    suppressClick = null
    originalMoves = options.moves || -> true
    settings = Object.assign({}, options)
    controls = 'a, button, input, textarea, select, label, video, audio, [contenteditable], [ng-click], [role="button"], [role="link"], [tabindex]'
    settings.moves = (item, source, handle, sibling) ->
        return false if touching && !ready && !probing
        return originalMoves(item, source, handle, sibling)
    drake = dragula(containers, settings)

    clearTimer = ->
        clearTimeout(timer) if timer
        timer = null
    clearPending = ->
        clearTimer()
        pending?.item.classList.remove('touch-drag-pending')
        pending = null
        ready = false
    replay = (type, point, target) ->
        event = new Event(type, {bubbles: true, cancelable: true})
        Object.defineProperties(event, {
            target: {value: target}
            touches: {value: if type == 'touchend' then [] else [point]}
            targetTouches: {value: if type == 'touchend' then [] else [point]}
            changedTouches: {value: [point]}
        })
        replaying = true
        try
            host.dispatchEvent(event)
        finally
            replaying = false
    start = (event) ->
        return if replaying
        drake.cancel(true) if ready && drake.dragging
        clearPending()
        touching = true
        suppressClick = null
        return unless event.touches.length == 1
        target = event.target
        return unless target instanceof Element
        probing = true
        try
            movable = drake.canMove(target)
        finally
            probing = false
        return unless movable
        item = target
        until drake.containers.indexOf(item.parentNode) != -1 || settings.isContainer?(item.parentNode)
            item = item.parentNode
        control = target
        while control && control != item
            return if control.matches(controls) && !control.matches('.epic-row, .card-inner')
            control = control.parentElement
        point = event.touches[0]
        pending = {target: target, item: item, point: point, x: point.clientX, y: point.clientY, id: point.identifier}
        item.classList.add('touch-drag-pending')
        timer = setTimeout (->
            return unless pending && pending.item.isConnected
            ready = true
            pending.item.classList.remove('touch-drag-pending')
            replay('touchstart', pending.point, pending.target)
            replay('touchmove', pending.point, pending.target)
            suppressClick = {item: pending.item, until: Date.now() + 2000}
        ), 800
    move = (event) ->
        return if replaying || !pending
        point = Array.from(event.touches).find((p) -> p.identifier == pending.id)
        if event.touches.length != 1 || !point
            drake.cancel(true) if drake.dragging
            clearPending()
            return
        unless ready
            if Math.hypot(point.clientX - pending.x, point.clientY - pending.y) > 10
                clearPending()
            return
        event.preventDefault() if event.cancelable
    finish = (event) ->
        return if replaying
        event.preventDefault() if ready && event.cancelable
        if event.type == 'touchcancel' && ready
            drake.cancel(true)
            replay('touchend', pending.point, pending.target) if pending
        suppressClick.until = Date.now() + 800 if suppressClick
        clearPending()
        touching = false
    click = (event) ->
        if suppressClick && Date.now() < suppressClick.until && suppressClick.item.contains(event.target)
            event.preventDefault()
            event.stopImmediatePropagation()
            suppressClick = null
    context = (event) ->
        event.preventDefault() if pending && pending.item.contains(event.target)
    blur = ->
        drake.cancel(true) if ready && drake.dragging
        clearPending()
        touching = false
    window.addEventListener('blur', blur)
    host.addEventListener('touchstart', start, {capture: true, passive: false})
    host.addEventListener('touchmove', move, {capture: true, passive: false})
    host.addEventListener('touchend', finish, {capture: true, passive: false})
    host.addEventListener('touchcancel', finish, true)
    host.addEventListener('click', click, true)
    host.addEventListener('contextmenu', context, true)
    destroy = drake.destroy
    drake.destroy = ->
        clearPending()
        window.removeEventListener('blur', blur)
        host.removeEventListener('touchstart', start, true)
        host.removeEventListener('touchmove', move, true)
        host.removeEventListener('touchend', finish, true)
        host.removeEventListener('touchcancel', finish, true)
        host.removeEventListener('click', click, true)
        host.removeEventListener('contextmenu', context, true)
        destroy()
    return drake
