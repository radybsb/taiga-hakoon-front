###
# This source code is licensed under the GNU Affero General Public License.
###

TaskDetailLightbox = (lightboxService, attachments, modelTransform, $rs, $rootScope, $confirm, $translate) ->
    link = (scope, el) ->
        el.data('scope', scope)
        previousScope = modelTransform.scope
        previousProp = modelTransform.prop
        previousAttachments = {}
        for key in ['_attachments', '_deprecatedsCount', '_attachmentsVisible', '_deprecatedsVisible', 'uploadingAttachments', '_attachmentContext']
            previousAttachments[key] = attachments[key]
        scope.taskPopup = true
        scope.detailPopup = true
        scope.task = scope.popupTask
        scope.project = scope.popupProject
        scope.projectId = scope.project.id
        scope.taskId = scope.task.id
        scope.sectionName = $translate.instant('TASK.SECTION_NAME')
        scope.statusList = scope.project.task_statuses
        scope.statusById = taiga.groupBy(scope.statusList, (status) -> status.id)
        taiga.PageMixin.prototype.fillUsersAndRoles.call({scope: scope}, scope.project.members, scope.project.roles)
        scope.attachmentsReady = false
        modelTransform.setObject(scope, 'task')
        scope.ctrl = {}
        reload = ->
            $rs.tasks.getByRef(scope.projectId, scope.task.ref).then (task) ->
                scope.task = task unless scope.$$destroyed
        for action in ['watch', 'unwatch']
            do (action) ->
                scope.ctrl[if action == 'watch' then 'onWatch' else 'onUnwatch'] = ->
                    $rs.tasks[action](scope.taskId).then(reload)
        scope.$on 'comment:new', reload
        scope.$on 'promote-task-to-us:success', reload
        scope.$on 'custom-attributes-values:edit', -> $rootScope.$broadcast('object:updated')
        scope.$watch 'task.version', (version, previous) ->
            if version != previous
                $rootScope.$broadcast('taskform:edit:success', scope.task)
        attachments.loadAttachments('task', scope.taskId, scope.projectId).then ->
            scope.attachmentsReady = true unless scope.$$destroyed
        .catch ->
            scope.loadFailed = true
            $confirm.notify('error') unless scope.$$destroyed
        scope.$on '$destroy', ->
            attachments.invalidatePendingLoads?()
            for key, value of previousAttachments
                attachments[key] = value
            if modelTransform.scope == scope
                modelTransform.setObject(previousScope, previousProp)
            $rootScope.$broadcast('taskform:edit:success', scope.task)
            $rootScope.$broadcast('detail-popup:updated', {type: 'task', item: scope.task, projectId: scope.projectId})
        lightboxService.open(el)
    return {link: link, templateUrl: 'task/task-detail-lightbox.html'}

TaskDetailLightbox.$inject = ['lightboxService', 'tgAttachmentsFullService', '$tgQueueModelTransformation', '$tgResources', '$rootScope', '$tgConfirm', '$translate']
angular.module('taigaTasks').directive('tgTaskDetailLightbox', TaskDetailLightbox)
