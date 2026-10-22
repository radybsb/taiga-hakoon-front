###
# This source code is licensed under the terms of the
# GNU Affero General Public License found in the LICENSE file in
# the root directory of this source tree.
#
# Copyright (c) 2021-present Kaleidos INC
###

class AttachmentsFullService extends taiga.Service
    @.$inject = [
        "tgAttachmentsService",
        "$rootScope",
        "$q"
    ]

    constructor: (@attachmentsService, @rootScope, @q) ->
        @._attachments = Immutable.List()
        @._deprecatedsCount = 0
        @._attachmentsVisible = Immutable.List()
        @._deprecatedsVisible = false
        @.uploadingAttachments = []
        @uploadsByObject = {}
        @_attachmentContext = null
        @attachmentLoadVersion = 0
        @.types = @attachmentsService.types

        taiga.defineImmutableProperty @, 'attachments', () => return @._attachments
        taiga.defineImmutableProperty @, 'deprecatedsCount', () => return @._deprecatedsCount
        taiga.defineImmutableProperty @, 'attachmentsVisible', () => return @._attachmentsVisible
        taiga.defineImmutableProperty @, 'deprecatedsVisible', () => return @._deprecatedsVisible

    toggleDeprecatedsVisible: () ->
        @._deprecatedsVisible = !@._deprecatedsVisible
        @.regenerate()

    regenerate: () ->
        @._deprecatedsCount = @._attachments.count (it) -> it.getIn(['file', 'is_deprecated'])

        if @._deprecatedsVisible
            @._attachmentsVisible = @._attachments
        else
            @._attachmentsVisible = @._attachments.filter (it) -> !it.getIn(['file', 'is_deprecated'])

    contextKey: (type, objId, projectId) -> "#{projectId}:#{type}:#{objId}"

    invalidatePendingLoads: -> @attachmentLoadVersion += 1

    activateContext: (key) ->
        if @_attachmentContext != key
            @invalidatePendingLoads()
            @_attachmentContext = key
            @._attachments = Immutable.List()
            @._deprecatedsVisible = false
            @regenerate()
        @uploadsByObject[key] ||= []
        @uploadingAttachments = @uploadsByObject[key]

    addAttachment: (projectId, objId, type, file, editable = true, comment = false) ->
        return @q.reject(new Error(file)) unless @attachmentsService.validate(file)
        key = @contextKey(type, objId, projectId)
        @activateContext(key)
        uploads = @uploadingAttachments
        uploads.push(file)
        return @attachmentsService.upload(file, objId, projectId, type, comment).then (uploaded) =>
            attachment = Immutable.Map().merge({file: uploaded, editable: editable, loading: false, from_comment: comment})
            if @_attachmentContext == key
                @invalidatePendingLoads()
                @._attachments = @._attachments.filter((item) -> item.getIn(['file', 'id']) != uploaded.get('id')).push(attachment)
                @regenerate()
                @rootScope.$broadcast('attachment:create')
            @rootScope.$broadcast('attachment:saved', {type: type, projectId: projectId, item: {id: objId, project: projectId}})
            return attachment
        .finally ->
            # Match the original file, not a server-normalized filename, and
            # mutate the owning queue so saved popup contexts see the cleanup.
            index = uploads.indexOf(file)
            uploads.splice(index, 1) if index != -1

    loadAttachments: (type, objId, projectId)->
        key = @contextKey(type, objId, projectId)
        @activateContext(key)
        version = @invalidatePendingLoads()
        @attachmentsService.list(type, objId, projectId).then (files) =>
            return unless @_attachmentContext == key && @attachmentLoadVersion == version
            @._attachments = files.map (file) ->
                return Immutable.Map().merge({loading: false, editable: false, file: file})
            @regenerate()
            @rootScope.$broadcast("attachments:loaded", @._attachments)

    deleteAttachment: (toDeleteAttachment, type) ->
        key = @_attachmentContext
        onSuccess = () =>
            return unless @_attachmentContext == key
            @invalidatePendingLoads()
            @._attachments = @._attachments.filter (attachment) -> attachment != toDeleteAttachment

            @.regenerate()

        return @attachmentsService.delete(type, toDeleteAttachment.getIn(['file', 'id'])).then(onSuccess)

    reorderAttachment: (objectId, type, attachment, newIndex) ->
        @invalidatePendingLoads()
        oldIndex = @.attachments.findIndex (it) -> it == attachment

        attachments = @.attachments.remove(oldIndex)
        attachments = attachments.splice(newIndex, 0, attachment)

        attachments = attachments.map (x, i) -> x.setIn(['file', 'order'], i + 1)
        @._attachments = attachments
        @.regenerate()

        afterAttachmentId = null

        if newIndex > 0
            previousAttachment = @.attachments.get(newIndex - 1)
            afterAttachmentId = previousAttachment.getIn(['file', 'id'])

        return @attachmentsService.bulkUpdateOrder(
            objectId,
            type,
            afterAttachmentId,
            [attachment.getIn(['file', 'id'])],
        )

    updateAttachment: (toUpdateAttachment, type) ->
        key = @_attachmentContext
        index = @._attachments.findIndex (attachment) ->
            return attachment.getIn(['file', 'id']) == toUpdateAttachment.getIn(['file', 'id'])

        oldAttachment = @._attachments.get(index)

        patch = taiga.patch(oldAttachment.get('file'), toUpdateAttachment.get('file'))

        if toUpdateAttachment.get('loading')
            @.setAttachments(index, toUpdateAttachment)
        else
            if _.isEmpty(patch)
                @.setAttachments(index, toUpdateAttachment)
            else
                return @attachmentsService.patch(toUpdateAttachment.getIn(['file', 'id']), type, patch).then () =>
                    @.setAttachments(index, toUpdateAttachment) if @_attachmentContext == key

    setAttachments: (index, toUpdateAttachment) ->
        @invalidatePendingLoads()
        @._attachments = @._attachments.set(index, toUpdateAttachment)

        @.regenerate()


angular.module("taigaComponents").service("tgAttachmentsFullService", AttachmentsFullService)
