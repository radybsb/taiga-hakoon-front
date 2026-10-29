# Personal board backgrounds are stored per user and project in this browser.
BackgroundDirective = ($window, $document, $http, $config, $currentUser) ->
    restrict: 'E'
    scope: true
    templateUrl: 'components/kanban-background/kanban-background.html'
    link: (scope, el) ->
        board = el[0].closest('.kanban, .taskboard, .backlog, .epics, .issue-main')
        boardType = if board.classList.contains('issue-main') then 'issues' else ['kanban', 'taskboard', 'backlog', 'epics'].find((name) -> board.classList.contains(name))
        content = board
        board = board.closest('main.scrum') || board if boardType == 'backlog'
        # Credits belong to the board's background layer, outside the header controls.
        creditLayer = el[0].querySelector('.board-photo-credit-layer')
        board.classList.add('board-background-surface')
        board.appendChild(creditLayer)
        key = null
        alive = true
        requestId = 0
        scope.background = {open: false, section: null, photos: [], query: '', page: 1}
        vm = scope.background
        vm.colors = [
            ['Slate', '#334155', '#475569'], ['Ocean', '#164e63', '#28768c'],
            ['Indigo', '#373078', '#585398'], ['Lavender', '#8073a6', '#aaa0ca'],
            ['Forest', '#285448', '#447b69'], ['Sage', '#718875', '#a1b39b'],
            ['Teal', '#236d72', '#459396'], ['Sand', '#b09a7d', '#d3c2a4'],
            ['Rose', '#a1667e', '#c28b9f'], ['Terracotta', '#a65f4c', '#cb8b70'],
            ['Amber', '#ad823c', '#d0a960'], ['Sky', '#6389b5', '#92b2d1']
        ].map (c) -> {name: c[0], value: "linear-gradient(135deg, #{c[1]}, #{c[2]})"}
        apply = (value) ->
            vm.current = value
            board.classList.toggle('has-board-background', !!value)
            content.classList.toggle('has-board-background', !!value)
            board.style.backgroundImage = if value?.kind == 'color' then value.value else if value?.url then "url(\"#{value.url}\")" else ''
        save = (value) ->
            return unless key
            try
                if value then $window.localStorage.setItem(key, JSON.stringify(value)) else $window.localStorage.removeItem(key)
                apply(value)
                vm.open = false
                vm.error = null
            catch
                vm.error = 'The background could not be saved. Free some browser storage and try again.'
        scope.$watch (-> scope.project?.id || scope.vm?.project?.get?('id')), (id) ->
            return unless id
            key = "taiga.#{boardType}.background.#{$currentUser.getUser()?.get('id') || 'guest'}.#{id}"
            try
                value = JSON.parse($window.localStorage.getItem(key) || 'null')
                validColor = value?.kind == 'color' && vm.colors.some((c) -> c.value == value.value)
                validImage = value?.kind == 'custom' && /^data:image\/(webp|jpeg|png);base64,/.test(value.url)
                validPhoto = value?.kind == 'photo' && /^https:\/\/images\.unsplash\.com\//.test(value.url)
                apply(if validColor || validImage || validPhoto then value else null)
            catch
                apply(null)
        vm.toggle = ->
            vm.open = !vm.open
            vm.section = null
            vm.error = null
        vm.chooseColor = (color) -> save({kind: 'color', value: color.value, name: color.name})
        vm.reset = -> save(null)
        vm.show = (section) ->
            vm.section = section
            vm.error = null
            vm.search(true) if section == 'photos' && !vm.photos.length
        api = -> $config.get('api').replace(/\/$/, '') + '/background-photos'
        vm.search = (reset = true) ->
            return if vm.loading
            vm.page = 1 if reset
            vm.loading = true
            vm.error = null
            ticket = ++requestId
            $http.get(api(), {q: vm.query, page: vm.page}).then (response) ->
                return unless alive && ticket == requestId
                vm.photos = if reset then response.data.photos else vm.photos.concat(response.data.photos)
                vm.more = response.data.more
            .catch ->
                vm.error = 'Photos are currently unavailable. Please try again later.' if alive
            .finally -> vm.loading = false if alive
        vm.loadMore = ->
            vm.page += 1
            vm.search(false)
        vm.choosePhoto = (photo) ->
            return if vm.saving
            vm.saving = true
            vm.error = null
            # Unsplash requires tracking a photo selection as a download.
            $http.post(api() + '/select', {id: photo.id, token: photo.token}).then ->
                save({kind: 'photo', url: photo.url, name: photo.description, author: photo.author, profile: photo.profile}) if alive
            .catch -> vm.error = 'This photo could not be applied. Please try again.' if alive
            .finally -> vm.saving = false if alive
        input = el[0].querySelector('input[type=file]')
        changed = ->
            file = input.files?[0]
            return unless file
            vm.error = null
            if !/^image\/(jpeg|png|webp|avif|gif)$/.test(file.type) || file.size > 15 * 1024 * 1024
                scope.$evalAsync -> vm.error = 'Choose a JPG, PNG, WebP, AVIF or GIF image smaller than 15 MB.'
                input.value = ''
                return
            scope.$evalAsync -> vm.uploading = true
            reader = new $window.FileReader()
            fail = -> scope.$evalAsync ->
                vm.uploading = false
                vm.error = 'This image could not be opened. Please choose another file.'
            reader.onerror = fail
            reader.onload = ->
                image = new $window.Image()
                image.onerror = fail
                image.onload = ->
                    return unless alive
                    canvas = $document[0].createElement('canvas')
                    ratio = Math.min(1, 1920 / Math.max(image.width, image.height))
                    canvas.width = Math.max(1, Math.round(image.width * ratio))
                    canvas.height = Math.max(1, Math.round(image.height * ratio))
                    canvas.getContext('2d').drawImage(image, 0, 0, canvas.width, canvas.height)
                    scope.$evalAsync ->
                        vm.uploading = false
                        save({kind: 'custom', url: canvas.toDataURL('image/webp', .85), name: file.name})
                image.src = reader.result
            reader.readAsDataURL(file)
            input.value = ''
        input.addEventListener('change', changed)
        outside = (event) ->
            scope.$evalAsync(-> vm.open = false) if vm.open && !el[0].contains(event.target)
        escape = (event) ->
            if event.key == 'Escape' && vm.open
                scope.$evalAsync ->
                    vm.open = false
                    el[0].querySelector('.board-background-toggle').focus()
        $document[0].addEventListener('pointerdown', outside)
        $document[0].addEventListener('keydown', escape)
        scope.$on '$destroy', ->
            alive = false
            creditLayer.remove()
            board.classList.remove('board-background-surface')
            input.removeEventListener('change', changed)
            $document[0].removeEventListener('pointerdown', outside)
            $document[0].removeEventListener('keydown', escape)

BackgroundDirective.$inject = ['$window', '$document', '$tgHttp', '$tgConfig', 'tgCurrentUserService']
angular.module('taigaComponents').directive('tgKanbanBackground', BackgroundDirective)
