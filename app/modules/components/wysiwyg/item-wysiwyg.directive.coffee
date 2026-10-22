###
# This source code is licensed under the terms of the
# GNU Affero General Public License found in the LICENSE file in
# the root directory of this source tree.
#
# Copyright (c) 2021-present Kaleidos INC
###

# Used in details descriptions
ItemWysiwyg = ($modelTransform, $rootscope, $confirm, attachmentsFullService, $translate) ->
    link = ($scope, $el, $attrs) ->
        $scope.editableDescription = false
        $scope.descriptionState = {editing: false}
        $scope.descriptionCollapsed = false
        $scope.descriptionEditRequest = 0
        $scope.descriptionId = 'description-' + $scope.$id
        $scope.editDescription = ->
            return unless $scope.editableDescription
            $scope.descriptionCollapsed = false
            $scope.descriptionEditRequest += 1

        $scope.saveDescription = (description, cb) ->
            transform = $modelTransform.save (item) ->
                item.description = description

                return item

            transform.then ->
                $confirm.notify("success")
                $rootscope.$broadcast("object:updated")
                cb(true)

            transform.then null, ->
                $confirm.notify("error")
                cb(false)

        types = {
            epics: "epic",
            userstories: "us",
            userstory: "us",
            issues: "issue",
            tasks: "task",
            epic: "epic",
            us: "us"
            issue: "issue",
            task: "task",
        }

        $scope.uploadFiles = (file, cb) ->
            return attachmentsFullService.addAttachment($scope.project.id, $scope.item.id, types[$attrs.type], file).then (result) ->
                cb({
                    default: result.getIn(['file', 'url'])
                })

        $scope.$watch $attrs.model, (value) ->
            return if not value
            $scope.item = value
            $scope.version = value.version
            $scope.storageKey = $scope.project.id + "-" + value.id + "-" + $attrs.type

        $scope.$watch 'project', (project) ->
            return if !project

            $scope.editableDescription = !project.archived_code and project.my_permissions.indexOf($attrs.requiredPerm) != -1

    return {
        scope: true,
        link: link,
        template: """
            <div class="item-description" ng-class="{'description-editing': descriptionState.editing}">
                <div class="description-header">
                    <button type="button" class="description-toggle"
                        ng-class="{'is-collapsed': descriptionCollapsed}"
                        ng-click="descriptionCollapsed = !descriptionCollapsed"
                        aria-expanded="{{!descriptionCollapsed}}" aria-controls="{{descriptionId}}">
                        <svg class="description-content-icon" viewBox="0 0 16 16" aria-hidden="true"><path d="M1 2h14v1.5H1zm0 5.25h14v1.5H1zM1 12.5h7V14H1z"/></svg>
                        <svg class="description-chevron" viewBox="0 0 16 16" aria-hidden="true"><path d="m6 3 5 5-5 5-1-1 4-4-4-4z"/></svg>
                        <span translate="COMMON.FIELDS.DESCRIPTION"></span>
                    </button>
                    <button type="button" class="btn-small description-edit" variant="secondary"
                        ng-if="editableDescription && !descriptionState.editing"
                        ng-click="editDescription()" translate="COMMON.EDIT"></button>
                </div>
                <div class="description-body" id="{{descriptionId}}" ng-show="!descriptionCollapsed">
                <tg-wysiwyg
                    ng-if="editableDescription && project"
                    html-read-mode="true"
                    explicit-edit="true"
                    edit-request="descriptionEditRequest"
                    on-edit-mode-change="descriptionState.editing = editing"
                    project="project"
                    placeholder="'COMMON.DESCRIPTION.EMPTY '| translate"
                    version='version'
                    storage-key='storageKey'
                    content='item.description'
                    on-save='saveDescription(text, cb)'
                    on-upload-file='uploadFiles'>
                </tg-wysiwyg>
                <div
                    class="wysiwyg"
                    ng-if="!editableDescription && item.description.length"
                    tg-bind-wysiwyg-html="item.description"></div>

                <div
                    class="wysiwyg no-description"
                    ng-if="!editableDescription && !item.description.length">
                    {{'COMMON.DESCRIPTION.NO_DESCRIPTION' | translate}}
                </div>
                </div>
            </div>
        """
    }

angular.module("taigaComponents")
    .directive("tgItemWysiwyg", [
        "$tgQueueModelTransformation",
        "$rootScope",
        "$tgConfirm",
        "tgAttachmentsFullService",
        "$translate",
        ItemWysiwyg])
