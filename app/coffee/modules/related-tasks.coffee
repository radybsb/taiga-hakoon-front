###
# This source code is licensed under the terms of the
# GNU Affero General Public License found in the LICENSE file in
# the root directory of this source tree.
#
# Copyright (c) 2021-present Kaleidos INC
###

taiga = @.taiga
trim = @.taiga.trim
debounce = @.taiga.debounce

module = angular.module("taigaRelatedTasks", [])


RelatedTaskRowDirective = ($repo, $compile, $confirm, $rootscope, $loading, $template, $translate, $emojis) ->
    templateView = $template.get("task/related-task-row.html", true)
    templateEdit = $template.get("task/related-task-row-edit.html", true)

    link = ($scope, $el, $attrs, $model) ->
        saveTask = debounce 2000, (task) ->
            task.subject = $el.find('.task-name input').val()

            currentLoading = $loading()
                .target($el.find('.task-name'))
                .start()

            promise = $repo.save(task)
            promise.then =>
                currentLoading.finish()
                $rootscope.$broadcast("related-tasks:update")

            promise.then null, =>
                currentLoading.finish()
                $el.find('input').val(task.subject)
                $confirm.notify("error")
            return promise

        renderEdit = (task) ->
            if (@childScope)
                @childScope.$destroy()
            @childScope = $scope.$new()
            $el.off()
            $el.html($compile(templateEdit({task: task}))(childScope))

            $el.find(".task-name input").val(task.subject)

            $el.on "keyup", "input", (event) ->
                if event.keyCode == 13
                    saveTask($model.$modelValue).then ->
                        renderView($model.$modelValue)
                else if event.keyCode == 27
                    renderView($model.$modelValue)

            $el.on "click", ".save-task", (event) ->
                saveTask($model.$modelValue).then ->
                    renderView($model.$modelValue)

            $el.on "click", ".cancel-edit", (event) ->
                renderView($model.$modelValue)

        renderView = (task) ->
            perms = {
                modify_task: !$scope.project.archived_code && $scope.project.my_permissions.indexOf("modify_task") != -1
                delete_task: !$scope.project.archived_code && $scope.project.my_permissions.indexOf("delete_task") != -1
            }

            $el.html($compile(templateView({
                task: task,
                perms: perms,
                emojify: (text) -> $emojis.replaceEmojiNameByHtmlImgs(_.escape(text))
            }))($scope))

            $el.on "click", ".edit-task", ->
                renderEdit($model.$modelValue)
                $el.find('.task-name input').focus().select()

            $el.on "click", ".delete-task", (event) ->
                title = $translate.instant("TASK.TITLE_DELETE_ACTION")
                task = $model.$modelValue
                message = task.subject

                $confirm.askOnDelete(title, message).then (askResponse) ->
                    promise = $repo.remove(task)
                    promise.then ->
                        askResponse.finish()
                        $scope.$emit("related-tasks:delete")

                    promise.then null, ->
                        askResponse.finish(false)
                        $confirm.notify("error")

        $scope.$watch $attrs.ngModel, (val) ->
            return if not val

            $el.off()

            renderView(val)

        $scope.$on "related-tasks:assigned-to-changed", ->
            $rootscope.$broadcast("related-tasks:update")

        $scope.$on "related-tasks:status-changed", ->
            $rootscope.$broadcast("related-tasks:update")

        $scope.$on "$destroy", ->
            $el.off()

    return {link:link, require:"ngModel"}

module.directive("tgRelatedTaskRow", ["$tgRepo", "$compile", "$tgConfirm", "$rootScope", "$tgLoading",
                                      "$tgTemplate", "$translate", "$tgEmojis", RelatedTaskRowDirective])


RelatedTaskCreateFormDirective = ($repo, $compile, $confirm, $tgmodel, $loading, $analytics) ->
    newTask = {
        subject: ""
        assigned_to: null
        assigned_users: []
    }

    link = ($scope, $el, $attrs) ->
        createTask = (task) ->
            task.subject = $el.find('.task-name input').val()
            task.assigned_to = $scope.newTask.assigned_to
            task.assigned_users = ($scope.newTask.assigned_users || []).slice()
            task.status = $scope.newTask.status
            $scope.newTask.status = $scope.project.default_task_status
            $scope.newTask.assigned_to = null
            $scope.newTask.assigned_users = []

            currentLoading = $loading()
                .target($el.find('.task-name'))
                .start()

            promise = $repo.create("tasks", task)
            promise.then ->
                $analytics.trackEvent("task", "create", "create task on userstory", 1)
                currentLoading.finish()
                $scope.$emit("related-tasks:add")

            promise.then null, ->
                $el.find('input').val(task.subject)
                currentLoading.finish()
                $confirm.notify("error")

            return promise

        close = () ->
            $el.off()

            $scope.openNewRelatedTask = false

        reset = () ->
            newTask = {
                subject: ""
                assigned_to: null
                assigned_users: []
            }

            newTask["status"] = $scope.project.default_task_status
            newTask["project"] = $scope.project.id
            newTask["user_story"] = $scope.us.id

            $scope.newTask = $tgmodel.make_model("tasks", newTask)

        render = ->
            return if $scope.openNewRelatedTask

            $scope.openNewRelatedTask = true

            $el.on "submit", "form", (event)->
                event.preventDefault()
                createTask(newTask).then ->
                    reset()
                    $el.find('input').focus()

            $el.on "keyup", "input", (event)->
                if event.keyCode == 27
                    $scope.$apply () -> close()

        $scope.save = () ->
            createTask(newTask).then ->
                close()

        taiga.bindOnce $scope, "us", reset

        $scope.$on "related-tasks:show-form", ->
            $scope.$apply(render)

        $scope.$on "$destroy", ->
            $el.off()

    return {
        scope: true,
        link: link,
        templateUrl: 'task/related-task-create-form.html'
    }

module.directive("tgRelatedTaskCreateForm", ["$tgRepo", "$compile", "$tgConfirm", "$tgModel", "$tgLoading",
                                             "$tgAnalytics", RelatedTaskCreateFormDirective])


RelatedTaskCreateButtonDirective = ($repo, $compile, $confirm, $tgmodel, $template) ->
    template = $template.get("common/components/add-button.html", true)

    link = ($scope, $el, $attrs) ->
        $scope.$watch "project", (val) ->
            return if not val
            $el.off()
            if !$scope.project.archived_code and $scope.project.my_permissions.indexOf("add_task") != -1
                $el.html($compile(template())($scope))
            else
                $el.html("")

            $el.on "click", ".add-button", (event)->
                $scope.$emit("related-tasks:add-new-clicked")

        $scope.$on "$destroy", ->
            $el.off()

    return {link: link}

module.directive("tgRelatedTaskCreateButton", ["$tgRepo", "$compile", "$tgConfirm", "$tgModel",
                                               "$tgTemplate", RelatedTaskCreateButtonDirective])


# Fetch current versions before saving so bulk edits preserve unrelated fields.
RelatedTaskBulkActions = ($q, $repo) ->
    run = (projectId, storyId, ids, action, value) ->
        result = {succeeded: [], failed: []}
        promise = $q.when()
        for id in _.uniq(ids)
            do (id) ->
                promise = promise.then ->
                    $repo.queryOne('tasks', id, {project: projectId}).then (task) ->
                        throw new Error('Task no longer belongs to this story') unless task.project == projectId && task.user_story == storyId
                        switch action
                            when 'delete' then return $repo.remove(task)
                            when 'status' then task.status = value
                            when 'assigned'
                                task.assigned_users = _.uniq(value || [])
                                unless _.includes(task.assigned_users, task.assigned_to)
                                    task.assigned_to = task.assigned_users[0] || null
                            else throw new Error('Unknown task bulk action')
                        return $repo.save(task)
                    .then (-> result.succeeded.push(id)), (-> result.failed.push(id))
        return promise.then -> result
    return {run: run}

module.factory('tgRelatedTaskBulkActions', ['$q', '$tgRepo', RelatedTaskBulkActions])

RelatedTasksDirective = ($rootscope, bulkActions, $confirm, $translate, $lightboxFactory, $document) ->
    link = ($scope, $el, $attrs) ->
        vm = $scope.taskBulk = {selected: {}, ids: [], busy: false, confirming: false, statusOpen: false, message: '', failed: []}
        destroyed = false
        vm.permitted = (action) ->
            permission = if action == 'delete' then 'delete_task' else 'modify_task'
            return !$scope.project?.archived_code && _.includes($scope.project?.my_permissions, permission)
        vm.canSelect = -> vm.permitted('delete') || vm.permitted('status')
        vm.sync = ->
            vm.ids = (task.id for task in ($scope.tasks || []) when vm.selected[task.id])
            vm.all = !!$scope.tasks?.length && vm.ids.length == $scope.tasks.length
            vm.statusOpen = false
        vm.changed = ->
            vm.message = ''
            vm.failed = []
            vm.sync()
        vm.selectAll = ->
            return if vm.busy || vm.confirming
            vm.selected = {}
            vm.selected[task.id] = true for task in ($scope.tasks || []) when vm.all
            vm.changed()
        $scope.$watchCollection 'tasks', ->
            valid = _.map($scope.tasks || [], 'id')
            delete vm.selected[id] for id of vm.selected when !_.includes(valid, Number(id))
            vm.sync()
        $scope.$watch (-> vm.canSelect()), (allowed) ->
            unless allowed
                vm.selected = {}
                vm.sync()
        vm.execute = (action, value, ids = vm.ids.slice()) ->
            return if destroyed || vm.busy || !vm.permitted(action) || !ids.length
            if action == 'status'
                return unless _.some($scope.project.task_statuses, (status) -> status.id == value)
            vm.busy = true
            vm.statusOpen = false
            vm.message = ''
            vm.lastAction = action
            vm.lastValue = value
            return bulkActions.run($scope.project.id, $scope.us.id, ids.slice(), action, value).then (result) ->
                return if destroyed
                vm.failed = result.failed
                vm.selected = {}
                vm.selected[id] = true for id in result.failed
                vm.sync()
                vm.message = $translate.instant('TASK.BULK.RESULT', {success: result.succeeded.length, failed: result.failed.length})
                $rootscope.$broadcast('related-tasks:update')
            .catch ->
                return if destroyed
                vm.failed = ids.slice()
                vm.selected = {}
                vm.selected[id] = true for id in ids
                vm.sync()
                vm.message = $translate.instant('TASK.BULK.RESULT', {success: 0, failed: ids.length})
                $confirm.notify('error')
            .finally -> vm.busy = false
        vm.retry = -> vm.execute(vm.lastAction, vm.lastValue, vm.failed.slice())
        vm.assign = ->
            return unless vm.permitted('assigned') && vm.ids.length && !vm.busy
            ids = vm.ids.slice()
            vm.statusOpen = false
            $lightboxFactory.create('tg-lb-select-user', {'class': 'lightbox lightbox-select-user'}, {
                currentUsers: [], activeUsers: $scope.activeUsers, single: false,
                lbTitle: $translate.instant('TASK.BULK.ASSIGN'),
                onClose: (users) -> vm.execute('assigned', users.slice(), ids)
            })
        vm.remove = ->
            return unless vm.permitted('delete') && vm.ids.length && !vm.busy && !vm.confirming
            ids = vm.ids.slice()
            vm.statusOpen = false
            vm.confirming = true
            $confirm.askOnDelete(
                $translate.instant('TASK.BULK.DELETE_TITLE'),
                $translate.instant('TASK.BULK.DELETE_MESSAGE', {count: ids.length})
            ).then (answer) ->
                unless !destroyed && vm.permitted('delete')
                    answer.finish(false)
                    return
                operation = vm.execute('delete', null, ids)
                if operation
                    operation.then (-> answer.finish()), (-> answer.finish(false))
                else
                    answer.finish(false)
            .finally -> vm.confirming = false
        outside = (event) ->
            return if $el[0].contains(event.target)
            $scope.$evalAsync -> vm.statusOpen = false
        $document.on('click', outside)
        $el.on 'keydown.taskBulk', (event) ->
            if event.key == 'Escape' && vm.statusOpen
                event.stopPropagation()
                $scope.$evalAsync -> vm.statusOpen = false
        $scope.$on '$destroy', ->
            destroyed = true
            $document.off('click', outside)
            $el.off('keydown.taskBulk')

        _isVisible = ->
            if $scope.project
                return $scope.project.my_permissions.indexOf("view_tasks") != -1

            return false

        _isEditable = ->
            if $scope.project
                return !$scope.project.archived_code and $scope.project.my_permissions.indexOf("view_tasks") != -1
            return false

        $scope.reorderTask = (task, newIndex) ->
            $rootscope.$broadcast('task:reorder', task, newIndex)

        $scope.showAddTaks = ->
            if $scope.project
                return !$scope.project.archived_code and $scope.project.my_permissions.indexOf("add_task") != -1
            return false

        $scope.showRelatedTasks = ->
            return _isVisible()

        $scope.$on "related-tasks:add", ->
            $rootscope.$broadcast("related-tasks:update")

        $scope.$on "related-tasks:reordered", ->
            $rootscope.$broadcast("related-tasks:update")

        $scope.$on "related-tasks:delete", ->
            $rootscope.$broadcast("related-tasks:update")

        $scope.$on "related-tasks:add-new-clicked", ->
            $scope.$broadcast("related-tasks:show-form")

        $scope.$on "$destroy", ->
            $el.off()

    return {scope: true, link: link}

module.directive("tgRelatedTasks", ["$rootScope", "tgRelatedTaskBulkActions", "$tgConfirm", "$translate", "tgLightboxFactory", "$document", RelatedTasksDirective])


RelatedTaskAssignedToInlineEditionDirective = ($repo, $rootscope, $translate, avatarService, $lightboxFactory, $confirm) ->
    template = _.template("""
    <img style="background-color: <%- bg %>" src="<%- imgurl %>" alt="<%- name %>" title="<%- name %>"/>
    """)

    link = ($scope, $el, $attrs) ->
        task = $scope.$eval($attrs.tgRelatedTaskAssignedToInlineEdition)
        autoSave = !$scope.$eval($attrs.notAutoSave)
        saving = false
        editable = ->
            return !$scope.project?.archived_code && _.includes($scope.project?.my_permissions, 'modify_task')
        assignedIds = (item) -> _.uniq(_.compact([item?.assigned_to].concat(item?.assigned_users || [])))
        updateRelatedTask = ->
            ids = assignedIds(task)
            names = []
            avatars = (ids.length && ids) || [null]
            html = avatars.map (id) ->
                member = $scope.usersById?[id]
                avatar = avatarService.getAvatar(member)
                name = member?.full_name_display || $translate.instant('COMMON.ASSIGNED_TO.NOT_ASSIGNED')
                names.push(name)
                return template({bg: avatar.bg, imgurl: avatar.url, name: name})
            $el.find('.avatar').html(html.join(''))
            $el.find('.task-assignedto').attr({
                title: names.join(', '), 'aria-label': names.join(', '),
                role: if editable() then 'button' else null,
                tabindex: if editable() then '0' else null,
                'aria-disabled': String(!editable() || saving)
            }).toggleClass('editable', editable())

        $scope.$watchCollection (->
            task = $scope.$eval($attrs.tgRelatedTaskAssignedToInlineEdition)
            return assignedIds(task).concat([editable()])
        ), updateRelatedTask
        updateRelatedTask()

        openPicker = (event) ->
            event.preventDefault()
            event.stopPropagation()
            return unless editable() && !saving
            onClose = (users) ->
                return unless editable() && !saving && !$scope.$$destroyed
                previous = {assigned_to: task.assigned_to, assigned_users: (task.assigned_users || []).slice()}
                task.assigned_users = _.uniq(users.slice())
                unless _.includes(task.assigned_users, task.assigned_to)
                    task.assigned_to = task.assigned_users[0] || null
                updateRelatedTask()
                if autoSave
                    saving = true
                    $repo.save(task).then ->
                        $scope.$emit('related-tasks:assigned-to-changed') unless $scope.$$destroyed
                    .catch ->
                        task.assigned_to = previous.assigned_to
                        task.assigned_users = previous.assigned_users
                        $confirm.notify('error')
                    .finally ->
                        saving = false
                        updateRelatedTask() unless $scope.$$destroyed
            $lightboxFactory.create('tg-lb-select-user', {'class': 'lightbox lightbox-select-user'}, {
                currentUsers: assignedIds(task), activeUsers: $scope.activeUsers,
                onClose: onClose, single: false,
                lbTitle: $translate.instant('COMMON.ASSIGNED_USERS.ADD')
            })

        $el.on('click', '.task-assignedto', openPicker)
        $el.on 'keydown', '.task-assignedto', (event) ->
            openPicker(event) if event.key in ['Enter', ' ']
        $scope.$on '$destroy', -> $el.off()
    return {link: link}

module.directive("tgRelatedTaskAssignedToInlineEdition", ["$tgRepo", "$rootScope", "$translate", "tgAvatarService",
                                                          "tgLightboxFactory", "$tgConfirm", RelatedTaskAssignedToInlineEditionDirective])
