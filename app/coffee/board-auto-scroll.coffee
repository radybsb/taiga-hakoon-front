# Scroll the visible edges of nested board viewports, independently on each axis.
@taiga.boardAutoScroll = (drake, root) ->
    doc = document
    host = doc.documentElement
    point = null
    frame = null
    replaying = false
    moved = (event) ->
        return if replaying
        p = event.touches?[0] || event
        point = {x: p.clientX, y: p.clientY, touch: !!event.touches, id: p.identifier} if Number.isFinite(p.clientX)
    bounds = (el) ->
        rect = el.getBoundingClientRect()
        box = {left: Math.max(0, rect.left), top: Math.max(0, rect.top), right: Math.min(window.innerWidth, rect.right), bottom: Math.min(window.innerHeight, rect.bottom)}
        parent = el.parentElement
        while parent && parent != doc.body
            style = getComputedStyle(parent)
            r = parent.getBoundingClientRect()
            if /(auto|scroll|hidden)/.test(style.overflowX)
                box.left = Math.max(box.left, r.left)
                box.right = Math.min(box.right, r.right)
            if /(auto|scroll|hidden)/.test(style.overflowY)
                box.top = Math.max(box.top, r.top)
                box.bottom = Math.min(box.bottom, r.bottom)
            parent = parent.parentElement
        return box
    speed = (position, start, end) ->
        return 0 if end <= start || position < start - 24 || position > end + 24
        edge = Math.min(64, (end - start) / 3)
        if position < start + edge
            return -Math.ceil(18 * Math.min(1, (start + edge - position) / edge))
        if position > end - edge
            return Math.ceil(18 * Math.min(1, (position - end + edge) / edge))
        return 0
    scrollAxis = (targets, axis) ->
        horizontal = axis == 'x'
        prop = if horizontal then 'scrollLeft' else 'scrollTop'
        size = if horizontal then 'scrollWidth' else 'scrollHeight'
        client = if horizontal then 'clientWidth' else 'clientHeight'
        for target in targets
            continue unless target[size] > target[client]
            style = getComputedStyle(target)
            continue unless /(auto|scroll)/.test(if horizontal then style.overflowX else style.overflowY)
            box = bounds(target)
            continue if point.x < box.left - 24 || point.x > box.right + 24 || point.y < box.top - 24 || point.y > box.bottom + 24
            delta = speed(point[axis], (if horizontal then box.left else box.top), (if horizontal then box.right else box.bottom))
            before = target[prop]
            target[prop] = Math.max(0, Math.min(target[size] - target[client], before + delta))
            return true if target[prop] != before
        page = doc.scrollingElement || host
        viewport = if horizontal then window.innerWidth else window.innerHeight
        delta = speed(point[axis], 0, viewport)
        before = page[prop]
        page[prop] = Math.max(0, Math.min(Math.max(0, page[size] - viewport), before + delta))
        return page[prop] != before
    refresh = ->
        replaying = true
        try
            if point.touch
                p = {identifier: point.id, clientX: point.x, clientY: point.y, pageX: point.x + window.pageXOffset, pageY: point.y + window.pageYOffset}
                event = new Event('touchmove', {bubbles: true, cancelable: true})
                Object.defineProperties(event, {touches: {value: [p]}, targetTouches: {value: [p]}, changedTouches: {value: [p]}})
            else
                event = new MouseEvent('mousemove', {bubbles: true, cancelable: true, buttons: 1, clientX: point.x, clientY: point.y})
            host.dispatchEvent(event)
        finally
            replaying = false
    tick = ->
        frame = null
        return unless drake.dragging
        if point
            target = doc.elementFromPoint(point.x, point.y)
            target = root unless target && root.contains(target)
            targets = []
            while target && target != doc.body && target != host
                targets.push(target)
                target = target.parentElement
            x = scrollAxis(targets, 'x')
            y = scrollAxis(targets, 'y')
            refresh() if x || y
        frame = requestAnimationFrame(tick) if drake.dragging
    stop = ->
        cancelAnimationFrame(frame) if frame != null
        frame = null
    start = ->
        stop()
        frame = requestAnimationFrame(tick)
    window.addEventListener('blur', stop)
    host.addEventListener('mousemove', moved, true)
    host.addEventListener('touchmove', moved, {capture: true, passive: true})
    drake.on('drag', start)
    drake.on('dragend', stop)
    destroy = drake.destroy
    drake.destroy = ->
        stop()
        window.removeEventListener('blur', stop)
        host.removeEventListener('mousemove', moved, true)
        host.removeEventListener('touchmove', moved, true)
        drake.off('drag', start)
        drake.off('dragend', stop)
        destroy()
    return {destroy: stop}
