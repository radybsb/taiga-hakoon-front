###
# This source code is licensed under the terms of the
# GNU Affero General Public License found in the LICENSE file in
# the root directory of this source tree.
#
# Copyright (c) 2021-present Kaleidos INC
###

module = angular.module("taigaEpics")

class RelatedUserstoriesCreateController
    @.$inject = [
        "tgCurrentUserService",
        "tgResources",
        "$tgConfirm",
        "$tgAnalytics",
        "$q"
    ]

    constructor: (@currentUserService, @rs, @confirm, @analytics, @q) ->
        @.projects = null
        @.projectUserstories = Immutable.List()
        @.loading = false

    loadProjects: () ->
        if @.projects == null
            @.projects = @currentUserService.projects.get("unblocked")

    filterUss: (selectedProjectId, filterText) ->
        promise = @rs.userstories.listInAllProjects({project: selectedProjectId, q: filterText}, true).then (data) =>
            excludeIds = @.epicUserstories.map((us) -> us.get('id'))
            filteredData = data.filter((us) -> excludeIds.indexOf(us.get('id')) == -1)
            @.projectUserstories = filteredData
        promise

    saveRelatedUserStory: (selectedUserstoryIds, onSavedRelatedUserstory) ->
        return if @loading || !@validateExistingUserstoryForm()
        ids = _.uniq(if _.isArray(selectedUserstoryIds) then selectedUserstoryIds.slice() else [selectedUserstoryIds]).filter(Boolean)
        return unless ids.length
        @loading = true
        failed = false
        chain = @q.when()
        for id in ids
            do (id) =>
                chain = chain.then =>
                    @rs.epics.addRelatedUserstory(@epic.get('id'), id).then =>
                        if _.isArray(selectedUserstoryIds)
                            index = selectedUserstoryIds.indexOf(id)
                            selectedUserstoryIds.splice(index, 1) if index != -1
                        @analytics.trackEvent('epic related user story', 'create', 'create related user story on epic', 1)
                    , (data) =>
                        failed = true
                        @setExistingUserstoryFormErrors(data)
        return chain.then =>
            @loadRelatedUserstories()
            if failed
                @confirm.notify('error')
            else
                onSavedRelatedUserstory?()
        .finally => @loading = false

    bulkCreateRelatedUserStories: (selectedProjectId, userstoriesText, onCreatedRelatedUserstory) ->
        # This method assumes the following methods are binded to the controller:
        # - validateNewUserstoryForm
        # - setNewUserstoryFormErrors
        # - loadRelatedUserstories
        return if not @.validateNewUserstoryForm()

        @.loading = true

        onError = (data) =>
            @.loading = false
            @confirm.notify("error")
            @.setNewUserstoryFormErrors(data)

        onSuccess = () =>
            @analytics.trackEvent("epic related user story", "create", "create related user story on epic", 1)
            @.loading = false
            if onCreatedRelatedUserstory
                onCreatedRelatedUserstory()
            @.loadRelatedUserstories()

        epicId = @.epic.get('id')
        @rs.epics.bulkCreateRelatedUserStories(epicId, selectedProjectId, userstoriesText).then(onSuccess, onError)


module.controller("RelatedUserstoriesCreateCtrl", RelatedUserstoriesCreateController)
