###
# This source code is licensed under the terms of the
# GNU Affero General Public License found in the LICENSE file in
# the root directory of this source tree.
#
# Copyright (c) 2021-present Kaleidos INC
###

class EpicRowController
    @.$inject = [
        "$tgConfirm",
        "tgProjectService",
        "tgEpicsService",
        "$translate"
    ]

    constructor: (@confirm, @projectService, @epicsService, @translate) ->
        @.displayUserStories = false
        @.displayAssignedTo = false
        @.displayStatusList = false
        @.loadingStatus = false

        # NOTE: We use project as no inmutable object to make
        #       the code compatible with the old code
        @.project = @projectService.project.toJS()

        @._calculateProgressBar()

    _calculateProgressBar: () ->
        if @.epic.getIn(['status_extra_info', 'is_closed']) == true
            @.percentage = "100%"
        else
            progress = @.epic.getIn(['user_stories_counts', 'progress'])
            total = @.epic.getIn(['user_stories_counts', 'total'])
            if total == 0
                @.percentage = "0%"
            else
                @.percentage = "#{progress * 100 / total}%"

    canEditEpics: () ->
        return @projectService.canEdit("modify_epic")

    canDeleteEpic: () ->
        return @projectService.canEdit('delete_epic')

    deleteEpic: () ->
        return unless @.canDeleteEpic() && !@.deleting
        @.deleting = true
        return @confirm.askOnDelete(@translate.instant('EPIC.ACTION_DELETE'), @.epic.get('subject'),
            'This action permanently deletes this epic.').then (askResponse) =>
                return @epicsService.deleteEpic(@.epic).then () =>
                    @.deleting = false
                    askResponse.finish()
                , () =>
                    @.deleting = false
                    askResponse.finish(false)
                    @confirm.notify('error')
            , () =>
                @.deleting = false

    toggleUserStoryList: () ->
        if !@.displayUserStories
            @epicsService.listRelatedUserStories(@.epic)
                .then (userStories) =>
                    @.epicStories = userStories
                    @.displayUserStories = true
                .catch =>
                    @confirm.notify('error')
        else
            @.displayUserStories = false

    updateStatus: (statusId) ->
        @.displayStatusList = false
        @.loadingStatus = true
        return @epicsService.updateEpicStatus(@.epic, statusId)
            .catch () =>
                @confirm.notify('error')
            .finally () =>
                @.loadingStatus = false

    updateAssignedTo: (member) ->
        @.assignLoader = true
        return @epicsService.updateEpicAssignedTo(@.epic, member?.id or null)
            .catch () =>
                @confirm.notify('error')
            .then () =>
                @.assignLoader = false

angular.module("taigaEpics").controller("EpicRowCtrl", EpicRowController)
