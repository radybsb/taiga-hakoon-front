###
# This source code is licensed under the GNU Affero General Public License.
###

module = angular.module('taigaBacklog')

# Use fresh models so additive updates preserve concurrent changes and versions.
# Resolve each result separately: a failed request must not hide successful ones.
BulkActions = ($q, $repo, $rs, rs) ->
    run = (projectId, ids, action, value) ->
        ids = _.uniq(ids)
        result = {succeeded: [], failed: []}
        if action == 'sprint'
            return $q.all(ids.map((id) -> $repo.queryOne('userstories', id, {project: projectId}))).then (stories) ->
                data = stories.map((us) -> {us_id: us.id, order: us.sprint_order})
                return $rs.userstories.bulkUpdateMilestone(projectId, value, data)
            .then (-> {succeeded: ids, failed: []}), (-> {succeeded: [], failed: ids})
        promise = $q.when()
        for id in _.uniq(ids)
            do (id) ->
                promise = promise.then ->
                    $repo.queryOne('userstories', id, {project: projectId}).then (us) ->
                        switch action
                            when 'delete' then return $repo.remove(us)
                            when 'epic'
                                return us if _.some(us.epics, (epic) -> epic.id == value)
                                return rs.epics.addRelatedUserstory(value, id)
                            when 'status' then us.status = value
                            when 'tag'
                                name = taiga.trim(value.name).toLowerCase()
                                tags = _.cloneDeep(us.tags || [])
                                return us if _.some(tags, (tag) -> tag[0].toLowerCase() == name)
                                tags.push([name, value.color])
                                us.tags = tags
                            when 'assigned'
                                us.assigned_users = _.union(us.assigned_users || [], value)
                                if !us.assigned_to && us.assigned_users.length
                                    us.assigned_to = us.assigned_users[0]
                            else throw new Error('Unknown backlog action')
                        return $repo.save(us)
                    .then (-> result.succeeded.push(id)), (-> result.failed.push(id))
        return promise.then -> result
    return {run: run}

BulkActions.$inject = ['$q', '$tgRepo', '$tgResources', 'tgResources']
module.factory('tgBacklogBulkActions', BulkActions)

BulkOptions = (bulk, $rs, $rootScope, $confirm, $translate, $lightboxFactory, $document) ->
    link = (scope, el) ->
        vm = scope.bulk = {open: false, busy: false, panel: null, failed: [], tags: []}
        backlog = el.closest('[tg-backlog]')
        controller = backlog.controller()
        selection = ->
            backlog.find('.backlog-table-body input:checkbox:checked').map((i, item) ->
                $(item).closest('.tg-scope').scope().us.id
            ).get()
        permitted = (action) ->
            permission = if action == 'delete' then 'delete_us' else if action == 'epic' then 'modify_epic' else 'modify_us'
            return !scope.project.archived_code && _.includes(scope.project.my_permissions, permission)
        vm.permitted = permitted
        vm.confirming = false
        vm.toggle = ->
            return if vm.busy
            vm.open = !vm.open
            vm.panel = null
            vm.message = '' if vm.open
            vm.failed = [] if vm.open
            vm.ids = selection() if vm.open
        vm.start = (action) ->
            return if vm.busy || !permitted(action)
            vm.ids = selection()
            return unless vm.ids.length
            vm.message = ''
            vm.failed = []
            vm.panel = null
            vm.open = action == 'tag'
            switch action
                when 'tag' then vm.show('tag')
                when 'assigned' then vm.assign()
                when 'epic' then vm.linkEpic()
        refresh = ->
            return controller.q.all([
                controller.loadUserstories(true, scope.userstories.length), controller.loadSprints(),
                controller.loadClosedSprints(), controller.loadProjectStats(), controller.generateFilters()
            ]).then ->
                $rootScope.$broadcast('filters:update')
                $rootScope.$broadcast('tags:updated')
                backlog.find('.backlog-table-body input:checkbox').prop('checked', false)
                backlog.find('.us-item-row').removeClass('is-checked ui-multisortable-multiple')
                backlog.find('.move-to-sprint').hide()
        vm.execute = (action, value, ids = vm.ids) ->
            return if vm.busy || !permitted(action) || !ids?.length
            vm.busy = true
            vm.lastAction = action
            vm.lastValue = value
            vm.failed = []
            vm.message = ''
            bulk.run(scope.project.id, ids.slice(), action, value).then (result) ->
                vm.failed = result.failed
                vm.message = $translate.instant('BACKLOG.BULK.RESULT', {success: result.succeeded.length, failed: result.failed.length})
                vm.open = true
                vm.panel = null
                return refresh().catch -> $confirm.notify('error')
            .finally -> vm.busy = false
        vm.retry = -> vm.execute(vm.lastAction, vm.lastValue, vm.failed.slice())
        vm.remove = ->
            return unless permitted('delete') && !vm.busy && !vm.confirming
            ids = vm.ids.slice()
            vm.confirming = true
            $confirm.askOnDelete(
                $translate.instant('BACKLOG.BULK.DELETE_TITLE'),
                $translate.instant('BACKLOG.BULK.DELETE_MESSAGE', {count: ids.length}), ''
            ).then (answer) ->
                vm.execute('delete', null, ids).then(-> answer.finish()).catch(-> answer.finish(false))
            .finally -> vm.confirming = false
        vm.show = (panel) ->
            return if vm.busy
            vm.panel = panel
            if panel == 'sprint'
                vm.loadingSprints = true
                # No closed filter: include open and closed project sprints.
                $rs.sprints.list(scope.project.id).then (result) ->
                    vm.sprints = _.orderBy(result.milestones, ['estimated_start', 'id'], ['desc', 'desc'])
                .catch(-> $confirm.notify('error')).finally -> vm.loadingSprints = false
        vm.assign = ->
            return unless permitted('assigned') && !vm.busy
            ids = vm.ids.slice()
            $lightboxFactory.create('tg-lb-select-user', {'class': 'lightbox lightbox-select-user'}, {
                currentUsers: [], activeUsers: scope.activeUsers,
                lbTitle: $translate.instant('COMMON.ASSIGNED_USERS.ADD'),
                onClose: (users) -> vm.execute('assigned', users, ids) if users.length
            })
        vm.linkEpic = ->
            return unless permitted('epic') && !vm.busy
            ids = vm.ids.slice()
            $rootScope.$broadcast('relate-to-epic:add', {
                epics: [],
                onLink: (epicId) -> vm.execute('epic', Number(epicId), ids)
            })
        vm.addTag = (name, color) ->
            return unless taiga.trim(name).length
            vm.execute('tag', {name: name, color: color})
        outside = (event) ->
            return if el[0].contains(event.target) || vm.busy || vm.failed.length
            scope.$evalAsync -> vm.open = false
        keydown = (event) ->
            if event.key == 'Escape' && !vm.busy
                event.stopPropagation()
                scope.$evalAsync -> vm.open = false
        selectionChanged = ->
            scope.$evalAsync -> vm.open = false unless vm.busy
        backlog.on('change.backlogBulk', '.backlog-table-body input:checkbox', selectionChanged)
        $document.on('click', outside)
        el.on('keydown', keydown)
        scope.$on '$destroy', ->
            backlog.off('change.backlogBulk', '.backlog-table-body input:checkbox', selectionChanged)
            $document.off('click', outside)
            el.off('keydown', keydown)
    return {scope: true, link: link, templateUrl: 'backlog/bulk-options.html'}

BulkOptions.$inject = ['tgBacklogBulkActions', '$tgResources', '$rootScope', '$tgConfirm', '$translate', 'tgLightboxFactory', '$document']
module.directive('tgBacklogBulkOptions', BulkOptions)

# Render the exact status dropdown used by /us with a batch save callback.
BulkStatus = ($template, $compile, $translate, $timeout) ->
    link = (scope, el) ->
        template = $template.get('common/components/status-button.html', true)
        el.html(template({status: {name: $translate.instant('COMMON.FIELDS.STATUS'), color: ''}, statuses: scope.project.us_statuses, editable: true}))
        $compile(el.contents())(scope)
        openDropdown = $timeout((-> el.find('.pop-status').popover().open()), 0)
        el.on 'click', '.js-edit-status', (event) ->
            event.preventDefault()
            event.stopPropagation()
            el.find('.pop-status').popover().open()
        el.on 'click', '.status', (event) ->
            event.preventDefault()
            event.stopPropagation()
            el.find('.pop-status').popover().close()
            id = Number($(event.currentTarget).data('status-id'))
            scope.$apply -> scope.bulk.execute('status', id)
        scope.$on '$destroy', ->
            $timeout.cancel(openDropdown)
            el.off()
    return {link: link}
BulkStatus.$inject = ['$tgTemplate', '$compile', '$translate', '$timeout']
module.directive('tgBacklogBulkStatus', BulkStatus)
