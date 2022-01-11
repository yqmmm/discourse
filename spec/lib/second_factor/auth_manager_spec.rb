# frozen_string_literal: true

require 'rails_helper'

describe SecondFactor::AuthManager do
  fab!(:user) { Fabricate(:user) }
  fab!(:guardian) { Guardian.new(user) }

  def create_request(request_method: "GET", path: "/")
    ActionDispatch::TestRequest.create({
      "REQUEST_METHOD" => request_method,
      "PATH_INFO" => path
    })
  end

  def create_manager(action)
    SecondFactor::AuthManager.new(user, guardian, action)
  end

  def create_action
    klass = Class.new(SecondFactor::Actions::Base) do
      attr_reader :called_methods

      def no_second_factors_enabled!(params)
        (@called_methods ||= []) << __method__
      end

      def second_factor_auth_required!(params)
        (@called_methods ||= []) << __method__
      end

      def second_factor_auth_successful!(callback_params)
        (@called_methods ||= []) << __method__
      end
    end
    klass.new(user, guardian)
  end

  describe '#allow_backup_codes!' do
    it 'adds the backup codes method to the allowed methods set' do
      manager = create_manager(create_action)
      expect(manager.allowed_methods).not_to include(
        UserSecondFactor.methods[:backup_codes]
      )
      manager.allow_backup_codes!
      expect(manager.allowed_methods).to include(
        UserSecondFactor.methods[:backup_codes]
      )
    end
  end

  describe '#run!' do
    context 'when the user does not have a suitable 2FA method' do
      it 'calls the no_second_factors_enabled! method of the action' do
        request = create_request
        action = create_action
        manager = create_manager(action)
        manager.run!(request, {}, {})
      end
    end
  end
end
