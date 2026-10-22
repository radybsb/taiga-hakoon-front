###
# This source code is licensed under the GNU Affero General Public License.
###

module = angular.module('taigaTaskboard')

TaskboardUsStatus = ($repo, $confirm, $template, $compile, $rootScope) ->
    template = $template.get('common/components/status-button.html', true)
    link = (scope, el, attrs, model) ->
        busy = false
        editable = ->
            return !scope.project.archived_code && _.includes(scope.project.my_permissions, 'modify_us')
        render = ->
            us = model.$modelValue
            status = scope.usStatusById[us?.status]
            return unless status
            el.html(template({status: status, statuses: scope.usStatusList, editable: editable()}))
            trigger = el.find('.js-edit-status')
            button = $('<button type="button" class="detail-status-inner js-edit-status">')
            button.attr('aria-haspopup', 'true').attr('aria-expanded', 'false')
            button.prop('disabled', busy || !editable()).append(trigger.contents())
            trigger.replaceWith(button)
            $compile(el.contents())(scope)
        el.on 'click', '.js-edit-status', (event) ->
            event.preventDefault()
            event.stopPropagation()
            return if busy || !editable()
            el.find('.pop-status').popover().open()
            el.find('.js-edit-status').attr('aria-expanded', 'true')
        el.on 'click', '.status', (event) ->
            event.preventDefault()
            event.stopPropagation()
            return if busy || !editable()
            status = Number($(event.currentTarget).data('status-id'))
            return unless scope.usStatusById[status]
            el.find('.pop-status').popover().close()
            el.find('.js-edit-status').attr('aria-expanded', 'false')
            us = model.$modelValue
            return if status == us.status
            busy = true
            el.find('.js-edit-status').prop('disabled', true)
            # Sprint summaries lack the complete, current story model/version.
            $repo.queryOne('userstories', us.id, {project: scope.project.id}).then (fresh) ->
                fresh.status = status
                return $repo.save(fresh)
            .then (saved) ->
                us.status = saved.status
                us.is_closed = saved.is_closed
                us.version = saved.version
                $rootScope.$broadcast('object:updated')
            .catch -> $confirm.notify('error')
            .finally ->
                busy = false
                render()
        scope.$watchGroup(['us.status', 'project.archived_code', 'project.my_permissions', 'usStatusList'], render)
        scope.$on '$destroy', -> el.off()
    return {restrict: 'A', require: 'ngModel', link: link}

TaskboardUsStatus.$inject = ['$tgRepo', '$tgConfirm', '$tgTemplate', '$compile', '$rootScope']
module.directive('tgTaskboardUsStatus', TaskboardUsStatus)
